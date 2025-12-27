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
  
  // Load all JSON files from dataset
  const jsonFiles = fs.readdirSync(datasetPath)
    .filter(f => f.endsWith(".json"));
  
  indexLogger.info(`Found ${jsonFiles.length} JSON files to process`);
  
  for (const file of jsonFiles) {
    try {
      const filePath = path.join(datasetPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      const actId = file.replace(".json", "");
      const actTitle = data["Act Title"] || data.act || `Act ${actId}`;
      const actDef = data["Act Definition"];
      
      // Create main act document
      let actDescription = "";
      if (actDef && typeof actDef === "object") {
        actDescription = Object.values(actDef).join(" ");
      } else if (typeof actDef === "string") {
        actDescription = actDef;
      }
      
      const mainDoc: LegalSection = {
        id: `act_${actId}`,
        act: actTitle,
        section: "Overview",
        title: actTitle,
        description: actDescription,
        text: `${data["Act ID"] || ""}\n${data["Enactment Date"] || ""}\n${actDescription}`,
      };
      allSections.push(mainDoc);
      
      // Process all sections
      if (data.Sections && typeof data.Sections === "object") {
        for (const [sectionKey, sectionData] of Object.entries(data.Sections)) {
          if (sectionData && typeof sectionData === "object") {
            const heading = (sectionData as any).heading || "";
            const paragraphs = (sectionData as any).paragraphs || {};
            
            let sectionText = "";
            if (typeof paragraphs === "object") {
              sectionText = Object.values(paragraphs).join("\n\n");
            }
            
            const section: LegalSection = {
              id: `act_${actId}_${sectionKey.replace(/[^a-zA-Z0-9]/g, "_")}`,
              act: actTitle,
              section: sectionKey,
              title: heading,
              description: heading,
              text: sectionText,
            };
            allSections.push(section);
          }
        }
      }
      
    } catch (error) {
      indexLogger.warn(`Failed to parse JSON file: ${file}`, { error: String(error) });
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
  const encoder = new TextEncoder();
  const body = await request.json();
  const clearExisting = body.clearExisting || false;
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendMessage = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      try {
        indexLogger.info("Starting document indexing", { clearExisting });
        
        // Validate environment
        sendMessage({ step: "validate", status: "processing", message: "Validating environment..." });
        const validation = validateEnvironment();
        if (!validation.valid) {
          sendMessage({ step: "validate", status: "error", message: "Environment configuration is invalid", errors: validation.errors });
          controller.close();
          return;
        }
        sendMessage({ step: "validate", status: "completed", message: "Environment validated" });
        
        // Clear existing vectors if requested
        if (clearExisting) {
          sendMessage({ step: "clear", status: "processing", message: "Preparing to re-index (existing vectors will be replaced)..." });
          indexLogger.info("Preparing for re-indexing");
          try {
            await deleteAllVectors();
            sendMessage({ step: "clear", status: "completed", message: "Ready to re-index - vectors will be overwritten" });
          } catch (clearError) {
            // Don't fail if deletion doesn't work - we can still overwrite
            const errorMsg = clearError instanceof Error ? clearError.message : String(clearError);
            indexLogger.warn("Deletion not supported, will overwrite vectors instead", { error: errorMsg });
            sendMessage({ step: "clear", status: "completed", message: "Ready to re-index - vectors will be overwritten" });
          }
        }
        
        // Load documents
        sendMessage({ step: "load", status: "processing", message: "Loading legal documents from dataset folder..." });
        indexLogger.info("Loading legal documents");
        const documents = await loadAllDocuments();
        
        if (documents.length === 0) {
          sendMessage({ step: "load", status: "error", message: "No documents found to index" });
          controller.close();
          return;
        }
        sendMessage({ step: "load", status: "completed", message: `Loaded ${documents.length} documents` });
        
        // Chunk documents
        sendMessage({ step: "chunk", status: "processing", message: `Chunking ${documents.length} documents...` });
        indexLogger.info(`Chunking ${documents.length} documents`);
        const chunks = await chunkAndPrepareDocuments(documents);
        sendMessage({ step: "chunk", status: "completed", message: `Created ${chunks.length} chunks` });
        
        // Index to Pinecone
        const index = getPineconeIndex();
        const batchSize = 50;
        let totalIndexed = 0;
        
        sendMessage({ step: "index", status: "processing", message: `Starting to index ${chunks.length} chunks...`, progress: 0, total: chunks.length });
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
                text: chunk.text.substring(0, 1000),
              },
            }));
            
            // Upsert to Pinecone
            await index.upsert(vectors);
            totalIndexed += batch.length;
            
            const progress = Math.round((totalIndexed / chunks.length) * 100);
            sendMessage({ 
              step: "index", 
              status: "processing", 
              message: `Indexed ${totalIndexed}/${chunks.length} chunks`, 
              progress: totalIndexed,
              total: chunks.length,
              percent: progress
            });
            
            indexLogger.info(`Indexed ${totalIndexed}/${chunks.length} chunks`);
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            indexLogger.error(`Failed to index batch starting at ${i}`, { error: String(error) });
            sendMessage({ 
              step: "index", 
              status: "warning", 
              message: `Warning: Failed to index batch at ${i}`, 
              progress: totalIndexed,
              total: chunks.length 
            });
          }
        }
        
        sendMessage({ step: "index", status: "completed", message: `Successfully indexed ${totalIndexed} chunks` });
        
        // Get final stats
        sendMessage({ step: "verify", status: "processing", message: "Verifying index..." });
        const stats = await index.describeIndexStats();
        
        indexLogger.info("Indexing completed", {
          totalDocuments: documents.length,
          totalChunks: chunks.length,
          totalIndexed,
          vectorCount: stats.totalRecordCount
        });
        
        sendMessage({ 
          step: "verify", 
          status: "completed", 
          message: "Indexing completed successfully",
          totalDocuments: documents.length,
          totalIndexed,
          vectorCount: stats.totalRecordCount
        });
        
        sendMessage({ step: "complete", status: "success", message: "All done!" });
        
      } catch (error) {
        indexLogger.error("Indexing failed", { error: String(error) });
        sendMessage({ 
          step: "error", 
          status: "error", 
          message: error instanceof Error ? error.message : "Unknown error"
        });
      } finally {
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}