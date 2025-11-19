#!/usr/bin/env node

/**
 * Script to index legal documents from CSV files into Pinecone
 * Usage: npm run index-docs [--clear]
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), ".env") });

import { parse } from "csv-parse/sync";
import { getPineconeIndex, checkPineconeConnection, deleteAllVectors } from "../lib/pinecone";
import { embedTexts } from "../lib/openai";
import { indexLogger } from "../lib/logger";
import { validateEnvironment } from "../lib/env";

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
  }
}

async function loadAllCSVFiles(): Promise<LegalSection[]> {
  const datasetPath = path.join(process.cwd(), "dataset");
  const csvFiles = [
    { file: "ipc_sections.csv", act: "IPC" },
    { file: "bns_sections.csv", act: "BNS" },
    { file: "bsa_sections.csv", act: "BSA" },
    { file: "crpc_sections.csv", act: "CrPC" },
  ];
  
  const allSections: LegalSection[] = [];
  
  for (const { file, act } of csvFiles) {
    const filePath = path.join(datasetPath, file);
    if (fs.existsSync(filePath)) {
      const sections = await loadCSVFile(filePath, act);
      allSections.push(...sections);
    } else {
      indexLogger.warn(`CSV file not found: ${filePath}`);
    }
  }
  
  return allSections;
}

async function loadJSONStatutes(): Promise<LegalSection[]> {
  const datasetPath = path.join(process.cwd(), "dataset");
  const jsonFiles = fs.readdirSync(datasetPath).filter(f => f.endsWith(".json"));
  
  const statutes: LegalSection[] = [];
  
  for (const file of jsonFiles) {
    try {
      const filePath = path.join(datasetPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      // Extract ID from filename (remove .json extension)
      const statuteId = file.replace(".json", "");
      
      // Create a legal section from the JSON data
      const statute: LegalSection = {
        id: `statute_${statuteId}`,
        act: data.act || "Statute",
        section: statuteId,
        title: data.title || data.name || `Statute ${statuteId}`,
        description: data.description || "",
        text: data.text || data.content || JSON.stringify(data),
      };
      
      statutes.push(statute);
    } catch (error) {
      indexLogger.warn(`Failed to parse JSON file: ${file}`, { error: String(error) });
    }
  }
  
  indexLogger.info(`Loaded ${statutes.length} statutes from JSON files`);
  return statutes;
}

async function chunkLegalSections(sections: LegalSection[], chunkSize: number = 1000): Promise<any[]> {
  const chunks: any[] = [];
  
  for (const section of sections) {
    const fullText = `${section.act} - Section ${section.section}: ${section.title}\n\n${section.description}\n\n${section.text || ""}`;
    
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
      // Split large texts into chunks
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
      
      // Add the last chunk
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

async function indexToPinecone(chunks: any[], batchSize: number = 50) {
  const index = getPineconeIndex();
  let totalIndexed = 0;
  
  indexLogger.info(`Starting to index ${chunks.length} chunks to Pinecone`);
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(chunk => chunk.text);
    
    try {
      indexLogger.debug(`Generating embeddings for batch ${i / batchSize + 1}`);
      const embeddings = await embedTexts(texts);
      
      const vectors = batch.map((chunk, idx) => ({
        id: chunk.id,
        values: embeddings[idx],
        metadata: {
          ...chunk.metadata,
          text: chunk.text.substring(0, 2000), // Limit metadata text size
        },
      }));
      
      await index.upsert(vectors);
      totalIndexed += batch.length;
      
      indexLogger.info(`Indexed ${totalIndexed}/${chunks.length} chunks`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      indexLogger.error(`Failed to index batch starting at ${i}`, { error: String(error) });
      throw error;
    }
  }
  
  return totalIndexed;
}

async function main() {
  try {
    indexLogger.info("=== Legal Documents Indexing Script Started ===");
    
    // Validate environment
    const validation = validateEnvironment();
    if (!validation.valid) {
      indexLogger.fatal("Environment validation failed", undefined, {
        errors: validation.errors
      });
      process.exit(1);
    }
    
    // Check Pinecone connection
    const isConnected = await checkPineconeConnection();
    if (!isConnected) {
      indexLogger.fatal("Failed to connect to Pinecone");
      process.exit(1);
    }
    
    // Check for --clear flag
    const shouldClear = process.argv.includes("--clear");
    if (shouldClear) {
      indexLogger.warn("Clearing all existing vectors from Pinecone index");
      await deleteAllVectors();
    }
    
    // Load all legal documents
    indexLogger.info("Loading legal documents from dataset");
    const csvSections = await loadAllCSVFiles();
    const jsonStatutes = await loadJSONStatutes();
    const allSections = [...csvSections, ...jsonStatutes];
    
    indexLogger.info(`Total documents loaded: ${allSections.length}`);
    
    // Chunk the documents
    indexLogger.info("Chunking documents for indexing");
    const chunks = await chunkLegalSections(allSections);
    indexLogger.info(`Created ${chunks.length} chunks from ${allSections.length} documents`);
    
    // Index to Pinecone
    const totalIndexed = await indexToPinecone(chunks);
    
    // Final stats
    const index = getPineconeIndex();
    const stats = await index.describeIndexStats();
    
    indexLogger.info("=== Indexing Complete ===", {
      totalDocuments: allSections.length,
      totalChunks: chunks.length,
      totalIndexed,
      indexStats: {
        totalVectors: stats.totalRecordCount,
        dimension: stats.dimension,
        indexFullness: stats.indexFullness,
      },
    });
    
    process.exit(0);
  } catch (error) {
    indexLogger.fatal("Indexing script failed", error);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}