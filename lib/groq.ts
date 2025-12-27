import Groq from "groq-sdk";
import { openaiLogger } from "./logger";

let client: Groq | null = null;

// Groq model mappings
export const CHAT_MODEL = process.env.GROQ_MODEL || "mixtral-8x7b-32768";
// Note: Groq doesn't have a direct embedding model, we'll need to handle embeddings differently
// For now, we'll continue using OpenAI for embeddings or switch to a different solution

export function getGroqClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      openaiLogger.fatal("GROQ_API_KEY is not configured in the environment");
      throw new Error("GROQ_API_KEY is not configured in the environment.");
    }
    
    openaiLogger.info("Initializing Groq client", {
      chatModel: CHAT_MODEL
    });
    
    try {
      client = new Groq({ apiKey });
      openaiLogger.info("Groq client initialized successfully");
    } catch (error) {
      openaiLogger.error("Failed to initialize Groq client", { error: String(error) });
      throw error;
    }
  }
  return client;
}

// Import embeddings from our new HuggingFace-based solution
export { embedTexts, EMBEDDING_MODEL } from "./embeddings";