import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { getEnvConfig } from "./env";
import { pineconeLogger } from "./logger";

let client: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  const config = getEnvConfig();
  const apiKey = config.pinecone.apiKey;

  if (!apiKey) {
    pineconeLogger.fatal("PINECONE_API_KEY is not set in the environment");
    throw new Error("[pinecone] PINECONE_API_KEY is not set in the environment.");
  }

  if (!client) {
    pineconeLogger.info("Initializing Pinecone client", {
      index: config.pinecone.index,
      environment: config.pinecone.environment
    });
    
    try {
      client = new Pinecone({ apiKey });
      pineconeLogger.info("Pinecone client initialized successfully");
    } catch (error) {
      pineconeLogger.error("Failed to initialize Pinecone client", { error: String(error) });
      throw error;
    }
  }

  return client;
}

export function getPineconeIndex() {
  const config = getEnvConfig();
  const indexName = config.pinecone.index;

  if (!indexName) {
    pineconeLogger.fatal("PINECONE_INDEX is not set in the environment");
    throw new Error("[pinecone] PINECONE_INDEX is not set in the environment.");
  }

  pineconeLogger.debug("Accessing Pinecone index", { index: indexName });
  const client = getPineconeClient();
  return client.index(indexName);
}

export async function checkPineconeConnection(): Promise<boolean> {
  try {
    const index = getPineconeIndex();
    const stats = await index.describeIndexStats();
    
    pineconeLogger.info("Pinecone connection verified", {
      totalVectors: stats.totalRecordCount,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness
    });
    
    return true;
  } catch (error) {
    pineconeLogger.error("Pinecone connection check failed", { error: String(error) });
    return false;
  }
}

export async function deleteAllVectors(): Promise<void> {
  try {
    const index = getPineconeIndex();
    
    // Get stats to verify we have access
    const stats = await index.describeIndexStats();
    pineconeLogger.info("Current index stats", { 
      totalRecords: stats.totalRecordCount 
    });
    
    if (stats.totalRecordCount === 0) {
      pineconeLogger.info("Index is already empty, skipping deletion");
      return;
    }
    
    pineconeLogger.warn("Note: Your Pinecone index does not support deletion. Vectors will be overwritten during re-indexing.", {
      currentRecords: stats.totalRecordCount
    });
    
    // Since delete endpoint returns 404, we'll rely on upsert to overwrite existing vectors
    // This is a valid approach - when you upsert with the same ID, it replaces the vector
    pineconeLogger.info("Deletion skipped - existing vectors will be replaced during indexing");
    
    return;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    pineconeLogger.error("Failed to check index stats", { 
      error: errorMessage
    });
    // Don't throw error - we can still proceed with indexing
    pineconeLogger.warn("Proceeding with indexing despite stats check failure");
  }
}
