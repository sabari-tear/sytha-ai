import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { getPineconeIndex, deleteAllVectors } from "@/lib/pinecone";
import { embedTexts } from "@/lib/openai";
import { indexLogger } from "@/lib/logger";
import { validateEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for indexing

type LegalSection = {
  id: string;
  act: string;
  section: string;
  title: string;
  description: string;
  text?: string;
};

async function loadCSVFile(filePath: string, actName: string): Promise<LegalSection[]> {
  try {
    indexLogger.info(`Loading CSV file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    
    const sections: LegalSection[] = records.map((record: any, index: number) => ({
      id: `${actName.toLowerCase()}_${record.section || index}`,
      act: actName,
      section: record.section || record.Section || "",
      title: record.title || record.Title || "",
      description: record.description || record.Description || "",
      text: record.text || record.Text || record.description || "",
    }));
    
    indexLogger.info(`Loaded ${sections.length} sections from ${actName}`);
    return sections;
  } catch (error) {
        indexLogger.error(`Failed to load CSV file: ${filePath}`, { error: String(error) });
    throw error;
    return [];
  }
}

async function loadAllDocuments(): Promise<LegalSection[]> {
  const projectRoot = process.cwd();
  const datasetPath = path.join(projectRoot, "dataset");
  
  const csvFiles = [
    { file: "ipc_sections.csv", act: "IPC" },
    { file: "bns_sections.csv", act: "BNS" },
    { file: "bsa_sections.csv", act: "BSA" },
    { file: "crpc_sections.csv", act: "CrPC" },
  ];
  
  const allSections: LegalSection[] = [];
  
  // Load CSV files
  for (const { file, act } of csvFiles) {
    const filePath = path.join(datasetPath, file);
    if (fs.existsSync(filePath)) {
      const sections = await loadCSVFile(filePath, act);
      allSections.push(...sections);
    }
  }
  
  // Load JSON files (limited to avoid timeout)
  const jsonFiles = fs.readdirSync(datasetPath)
    .filter(f => f.endsWith(".json"))
    .slice(0, 100); // Limit to first 100 JSON files for demo
  
  for (const file of jsonFiles) {
    try {
      const filePath = path.join(datasetPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      const statuteId = file.replace(".json", "");
      const statute: LegalSection = {
        id: `statute_${statuteId}`,
        act: data.act || "Statute",
        section: statuteId,
        title: data.title || data.name || `Statute ${statuteId}`,
        description: data.description || "",
        text: data.text || data.content || JSON.stringify(data).substring(0, 1000),
      };
      
      allSections.push(statute);
    } catch (error) {
      // Skip invalid JSON files
    }
  }
  
  return allSections;
}

async function chunkAndPrepareDocuments(sections: LegalSection[], chunkSize: number = 800) {
  const chunks: any[] = [];
  
  for (const section of sections) {
    const fullText = `${section.act} - Section ${section.section}: ${section.title}\n\n${section.description}\n\n${section.text || ""}`.trim();
    
    if (fullText.length <= chunkSize) {
      chunks.push({
        id: section.id,
        text: fullText,
        metadata: {
          act: section.act,
          section: section.section,
          title: section.title,
          source: "legal_dataset",
        },
      });
    } else {
      // Split into smaller chunks
      const words = fullText.split(" ");
      let currentChunk = "";
      let chunkIndex = 0;
      
      for (const word of words) {
        if ((currentChunk + " " + word).length > chunkSize && currentChunk.length > 0) {
          chunks.push({
            id: `${section.id}_chunk_${chunkIndex}`,
            text: currentChunk.trim(),
            metadata: {
              act: section.act,
              section: section.section,
              title: section.title,
              source: "legal_dataset",
              chunkIndex,
            },
          });
          currentChunk = word;
          chunkIndex++;
        } else {
          currentChunk += (currentChunk ? " " : "") + word;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push({
          id: `${section.id}_chunk_${chunkIndex}`,
          text: currentChunk.trim(),
          metadata: {
            act: section.act,
            section: section.section,
            title: section.title,
            source: "legal_dataset",
            chunkIndex,
          },
        });
      }
    }
  }
  
  return chunks;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clearExisting = body.clearExisting || false;
    
    indexLogger.info("Starting document indexing", { clearExisting });
    
    // Validate environment
    const validation = validateEnvironment();
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        message: "Environment configuration is invalid",
        errors: validation.errors
      }, { status: 400 });
    }
    
    // Clear existing vectors if requested
    if (clearExisting) {
      indexLogger.info("Clearing existing vectors");
      await deleteAllVectors();
    }
    
    // Load documents
    indexLogger.info("Loading legal documents");
    const documents = await loadAllDocuments();
    
    if (documents.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No documents found to index"
      }, { status: 400 });
    }
    
    // Chunk documents
    indexLogger.info(`Chunking ${documents.length} documents`);
    const chunks = await chunkAndPrepareDocuments(documents);
    
    // Index to Pinecone
    const index = getPineconeIndex();
    const batchSize = 50;
    let totalIndexed = 0;
    
    indexLogger.info(`Starting to index ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(chunk => chunk.text);
      
      try {
        // Generate embeddings
        const embeddings = await embedTexts(texts);
        
        // Prepare vectors
        const vectors = batch.map((chunk, idx) => ({
          id: chunk.id,
          values: embeddings[idx],
          metadata: {
            ...chunk.metadata,
            text: chunk.text.substring(0, 1000), // Limit text in metadata
          },
        }));
        
        // Upsert to Pinecone
        await index.upsert(vectors);
        totalIndexed += batch.length;
        
        indexLogger.info(`Indexed ${totalIndexed}/${chunks.length} chunks`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        indexLogger.error(`Failed to index batch starting at ${i}`, { error: String(error) });
      }
    }
    
    // Get final stats
    const stats = await index.describeIndexStats();
    
    indexLogger.info("Indexing completed", {
      totalDocuments: documents.length,
      totalChunks: chunks.length,
      totalIndexed,
      vectorCount: stats.totalRecordCount
    });
    
    return NextResponse.json({
      success: true,
      message: "Indexing completed successfully",
      totalDocuments: documents.length,
      totalChunks: chunks.length,
      totalIndexed,
      vectorCount: stats.totalRecordCount
    }, { status: 200 });
    
  } catch (error) {
    indexLogger.error("Indexing failed", { error: String(error) });
    return NextResponse.json({
      success: false,
      message: "Indexing failed",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}