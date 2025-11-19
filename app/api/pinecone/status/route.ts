import { NextResponse } from "next/server";
import { getPineconeIndex } from "@/lib/pinecone";
import { apiLogger } from "@/lib/logger";
import { validateEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    apiLogger.info("Pinecone status check requested");
    
    // Validate environment first
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      apiLogger.warn("Environment validation failed for Pinecone status check", {
        errors: envValidation.errors
      });
      return NextResponse.json({
        configured: false,
        vectorCount: 0,
        errors: envValidation.errors
      }, { status: 200 });
    }
    
    // Check Pinecone index
    try {
      const index = getPineconeIndex();
      const stats = await index.describeIndexStats();
      
      const vectorCount = stats.totalRecordCount || 0;
      
      apiLogger.info("Pinecone status retrieved", {
        vectorCount,
        dimension: stats.dimension,
        indexFullness: stats.indexFullness
      });
      
      return NextResponse.json({
        configured: true,
        vectorCount,
        dimension: stats.dimension,
        indexFullness: stats.indexFullness,
        namespaces: stats.namespaces
      }, { status: 200 });
      
    } catch (error) {
      apiLogger.error("Failed to get Pinecone stats", { error: String(error) });
      return NextResponse.json({
        configured: false,
        vectorCount: 0,
        error: "Failed to connect to Pinecone index"
      }, { status: 200 });
    }
    
  } catch (error) {
    apiLogger.error("Pinecone status check failed", { error: String(error) });
    return NextResponse.json({
      configured: false,
      vectorCount: 0,
      error: "Internal server error"
    }, { status: 500 });
  }
}