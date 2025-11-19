import OpenAI from "openai";
import { openaiLogger } from "./logger";

let client: OpenAI | null = null;

export const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      openaiLogger.fatal("OPENAI_API_KEY is not configured in the environment");
      throw new Error("OPENAI_API_KEY is not configured in the environment.");
    }
    
    openaiLogger.info("Initializing OpenAI client", {
      chatModel: CHAT_MODEL,
      embeddingModel: EMBEDDING_MODEL
    });
    
    try {
      client = new OpenAI({ apiKey });
      openaiLogger.info("OpenAI client initialized successfully");
    } catch (error) {
      openaiLogger.error("Failed to initialize OpenAI client", { error: String(error) });
      throw error;
    }
  }
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) {
    openaiLogger.debug("No texts provided for embedding, returning empty array");
    return [];
  }
  
  openaiLogger.debug(`Generating embeddings for ${texts.length} text(s)`, {
    model: EMBEDDING_MODEL,
    totalChars: texts.reduce((sum, text) => sum + text.length, 0)
  });
  
  try {
    const client = getOpenAIClient();
    const startTime = Date.now();
    
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });
    
    const duration = Date.now() - startTime;
    openaiLogger.info(`Generated ${response.data.length} embeddings`, {
      duration: `${duration}ms`,
      model: EMBEDDING_MODEL
    });
    
    return response.data.map((item) => item.embedding);
  } catch (error) {
    openaiLogger.error("Failed to generate embeddings", { error: String(error) });
    throw error;
  }
}
