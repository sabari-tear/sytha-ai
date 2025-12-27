import { GoogleGenerativeAI } from "@google/generative-ai";
import { openaiLogger as logger } from "./logger";

let genAI: GoogleGenerativeAI | null = null;

// Gemini model configuration
export const CHAT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      logger.fatal("GEMINI_API_KEY is not configured in the environment");
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    
    logger.info("Initializing Google Gemini client", {
      chatModel: CHAT_MODEL
    });
    
    try {
      genAI = new GoogleGenerativeAI(apiKey);
      logger.info("Gemini client initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Gemini client", { error: String(error) });
      throw error;
    }
  }
  return genAI;
}

export async function generateAnswer(systemPrompt: string, userPrompt: string): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: CHAT_MODEL });
  
  logger.debug("Generating answer with Gemini", {
    model: CHAT_MODEL,
    promptLength: userPrompt.length
  });
  
  try {
    const startTime = Date.now();
    
    // Combine system and user prompts for Gemini
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,  // Increased for comprehensive legal answers
        topP: 0.8,
        topK: 40,
      },
    });
    
    const response = result.response;
    const text = response.text();
    
    const duration = Date.now() - startTime;
    logger.info(`Generated answer with Gemini`, {
      duration: `${duration}ms`,
      model: CHAT_MODEL,
      responseLength: text.length
    });
    
    return text;
  } catch (error) {
    logger.error("Failed to generate answer with Gemini", { error: String(error) });
    throw error;
  }
}