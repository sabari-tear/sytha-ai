import { NextResponse } from "next/server";
import { 
  answerLegalQuestion, 
  answerCaseQuestion, 
  answerDocumentQuestion, 
  initLegalIndex 
} from "@/lib/rag";
import { 
  getOrCreateSession, 
  addMessageToSession, 
  getConversationContext,
  type ChatMessage 
} from "@/lib/chat-session";
import { apiLogger } from "@/lib/logger";
import { validateEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

// Initialize on first request
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    apiLogger.info("Initializing legal chatbot API");
    
    // Validate environment - only throw if critical errors
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      const criticalErrors = envValidation.errors.filter(e => 
        e.includes('GEMINI_API_KEY') || e.includes('GEMINI_MODEL')
      );
      
      if (criticalErrors.length > 0) {
        apiLogger.error("Critical environment validation failed", undefined, {
          errors: criticalErrors
        });
        throw new Error("Critical environment configuration is invalid");
      } else {
        apiLogger.warn("Non-critical environment warnings", undefined, {
          warnings: envValidation.errors
        });
      }
    }
    
    // Initialize Pinecone index (optional - will use MongoDB fallback if not available)
    try {
      const indexStatus = await initLegalIndex();
      apiLogger.info("Index initialization complete", indexStatus);
    } catch (error) {
      apiLogger.warn("Pinecone initialization failed, will use MongoDB fallback", { error: String(error) });
    }
    
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
    const message = (body?.message ?? body?.question ?? "") as string;
    const mode = body?.mode || "legal";
    const userId = body?.userId || "anonymous";
    const caseId = body?.caseId;
    const documentId = body?.documentId;

    if (!message || !message.trim()) {
      apiLogger.warn("Invalid request - empty message", { requestId });
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    apiLogger.debug("Processing message", { 
      requestId, 
      mode,
      messageLength: message.length,
      userId,
      caseId,
      documentId
    });

    // Get or create session with conversation history
    const session = await getOrCreateSession(
      userId, 
      mode as 'legal' | 'case' | 'document',
      { caseId, documentId }
    );

    // Get conversation context from history
    const conversationHistory = await getConversationContext(session.sessionId, 5);

    // Add user message to session
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    await addMessageToSession(session.sessionId, userMessage);

    let result;
    
    // Handle different chat modes with conversation history
    switch(mode) {
      case 'case':
        if (!caseId) {
          return NextResponse.json(
            { error: "Case ID is required for case mode." },
            { status: 400 }
          );
        }
        result = await answerCaseQuestion(message, caseId);
        break;
        
      case 'document':
        if (!documentId) {
          return NextResponse.json(
            { error: "Document ID is required for document mode." },
            { status: 400 }
          );
        }
        result = await answerDocumentQuestion(message, documentId);
        break;
        
      case 'legal':
      default:
        result = await answerLegalQuestion(message, conversationHistory);
        break;
    }

    // Add assistant response to session
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: result.answer,
      timestamp: new Date(),
      sources: result.sources
    };
    await addMessageToSession(session.sessionId, assistantMessage);
    
    const processingTime = Date.now() - startTime;
    apiLogger.info("Request completed successfully", {
      requestId,
      processingTime: `${processingTime}ms`,
      sourcesCount: result.sources.length,
      mode
    });

    // Return in the format expected by frontend
    return NextResponse.json({
      response: result.answer,
      sources: result.sources
    }, { status: 200 });
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
