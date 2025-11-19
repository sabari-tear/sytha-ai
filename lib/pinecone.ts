import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { getEnvConfig } from "./env";
import { pineconeLogger } from "./logger";

let client: Pinecone | null = null;

function getPineconeClient(): Pinecone {
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
    pineconeLogger.warn("Deleting all vectors from index");
    
    await index.deleteAll();
    
    pineconeLogger.info("Successfully deleted all vectors from index");
  } catch (error) {
    pineconeLogger.error("Failed to delete vectors from index", error);
    throw error;
  }
}
