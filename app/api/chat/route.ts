import { NextResponse } from "next/server";
import { answerLegalQuestion, initLegalIndex } from "@/lib/rag";
import { apiLogger } from "@/lib/logger";
import { validateEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

// Initialize on first request
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    apiLogger.info("Initializing legal chatbot API");
    
    // Validate environment
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      apiLogger.error("Environment validation failed", undefined, {
        errors: envValidation.errors
      });
      throw new Error("Environment configuration is invalid");
    }
    
    // Initialize Pinecone index
    const indexStatus = await initLegalIndex();
    apiLogger.info("Index initialization complete", indexStatus);
    
    initialized = true;
  }
}

export async function POST(request: Request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  apiLogger.info("Received chat request", { requestId, method: "POST" });
  
  try {
    // Ensure system is initialized
    await ensureInitialized();
    
    const body = await request.json();
    const question = (body?.question ?? "") as string;

    if (!question || !question.trim()) {
      apiLogger.warn("Invalid request - empty question", { requestId });
      return NextResponse.json(
        { error: "Question is required." },
        { status: 400 },
      );
    }

    apiLogger.debug("Processing question", { 
      requestId, 
      questionLength: question.length 
    });

    const result = await answerLegalQuestion(question);
    
    const processingTime = Date.now() - startTime;
    apiLogger.info("Request completed successfully", {
      requestId,
      processingTime: `${processingTime}ms`,
      sourcesCount: result.sources.length
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;
    apiLogger.error("Request failed", {
      error: String(error),
      requestId,
      processingTime: `${processingTime}ms`
    });
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return NextResponse.json(
      { 
        error: "Failed to process your question. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 },
    );
  }
}
