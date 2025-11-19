import { NextResponse } from "next/server";
import { validateEnvironment } from "@/lib/env";
import { checkPineconeConnection } from "@/lib/pinecone";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  
  try {
    apiLogger.info("Health check requested");
    
    // Check environment configuration
    const envValidation = validateEnvironment();
    
    // Check Pinecone connection
    let pineconeStatus = false;
    let vectorCount = 0;
    
    if (envValidation.valid) {
      try {
        pineconeStatus = await checkPineconeConnection();
        
        if (pineconeStatus) {
          const { getPineconeIndex } = await import("@/lib/pinecone");
          const index = getPineconeIndex();
          const stats = await index.describeIndexStats();
          vectorCount = stats.totalRecordCount || 0;
        }
      } catch (error) {
        apiLogger.warn("Pinecone health check failed", { error: String(error) });
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    const health = {
      status: envValidation.valid && pineconeStatus ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks: {
        environment: {
          status: envValidation.valid ? "ok" : "error",
          errors: envValidation.errors.length > 0 ? envValidation.errors : undefined,
        },
        pinecone: {
          status: pineconeStatus ? "ok" : "error",
          vectorCount: pineconeStatus ? vectorCount : undefined,
        },
        openai: {
          status: envValidation.valid && !envValidation.errors.some(e => e.includes("OPENAI")) ? "ok" : "error",
        },
      },
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
    };
    
    const statusCode = health.status === "healthy" ? 200 : 503;
    
    apiLogger.info("Health check completed", {
      status: health.status,
      responseTime: health.responseTime,
    });
    
    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    apiLogger.error("Health check failed", { error: String(error) });
    
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}