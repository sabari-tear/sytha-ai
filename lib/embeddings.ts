import { HfInference } from "@huggingface/inference";
import { openaiLogger as logger } from "./logger";

let hf: HfInference | null = null;

// Free embedding model from HuggingFace
export const EMBEDDING_MODEL = process.env.HF_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
const EMBEDDING_DIMENSION = 384; // Dimension for all-MiniLM-L6-v2

export function getHuggingFaceClient(): HfInference {
  if (!hf) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    
    // HuggingFace works without API key but with rate limits
    // With API key, you get higher rate limits
    logger.info("Initializing HuggingFace client", {
      embeddingModel: EMBEDDING_MODEL,
      hasApiKey: !!apiKey
    });
    
    try {
      hf = new HfInference(apiKey || undefined);
      logger.info("HuggingFace client initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize HuggingFace client", { error: String(error) });
      throw error;
    }
  }
  return hf;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) {
    logger.debug("No texts provided for embedding, returning empty array");
    return [];
  }
  
  logger.debug(`Generating embeddings for ${texts.length} text(s)`, {
    model: EMBEDDING_MODEL,
    totalChars: texts.reduce((sum, text) => sum + text.length, 0)
  });
  
  try {
    const client = getHuggingFaceClient();
    const startTime = Date.now();
    
    // Process embeddings one by one for HuggingFace free tier
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const response = await client.featureExtraction({
        model: EMBEDDING_MODEL,
        inputs: text,
      });
      
      // HuggingFace returns embeddings in different formats
      // Handle the response appropriately
      if (Array.isArray(response)) {
        if (typeof response[0] === 'number') {
          // Single embedding returned as flat array
          embeddings.push(response as number[]);
        } else if (Array.isArray(response[0])) {
          // Multiple embeddings or nested array
          embeddings.push(response[0] as number[]);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Generated ${embeddings.length} embeddings`, {
      duration: `${duration}ms`,
      model: EMBEDDING_MODEL,
      dimension: embeddings[0]?.length || 0
    });
    
    return embeddings;
  } catch (error) {
    logger.error("Failed to generate embeddings", { error: String(error) });
    
    // If HuggingFace fails, provide helpful error message
    if (String(error).includes("rate limit")) {
      throw new Error("HuggingFace rate limit reached. Please wait a moment or add an API key for higher limits.");
    }
    throw error;
  }
}

export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}