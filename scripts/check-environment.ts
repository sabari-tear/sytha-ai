#!/usr/bin/env node

/**
 * Script to check and validate environment configuration
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), ".env") });

import { validateEnvironment, getEnvConfig } from "../lib/env";
import { checkPineconeConnection } from "../lib/pinecone";
import { getOpenAIClient } from "../lib/openai";

async function checkOpenAI(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    // Test with a minimal API call
    const response = await client.models.list();
    return response.data.length > 0;
  } catch (error) {
    console.error("❌ OpenAI connection failed:", error);
    return false;
  }
}

async function main() {
  console.log("=== Environment Configuration Check ===\n");
  
  // Check environment variables
  console.log("1. Checking environment variables...");
  const validation = validateEnvironment();
  
  if (validation.valid) {
    console.log("✅ Environment variables are properly configured");
  } else {
    console.log("❌ Environment configuration errors:");
    validation.errors.forEach(error => {
      console.log(`   - ${error}`);
    });
  }
  
  // Get configuration
  try {
    const config = getEnvConfig();
    console.log("\n2. Current configuration:");
    console.log(`   - OpenAI Model: ${config.openai.model}`);
    console.log(`   - Embedding Model: ${config.openai.embeddingModel}`);
    console.log(`   - Pinecone Index: ${config.pinecone.index}`);
    console.log(`   - Environment: ${config.app.nodeEnv}`);
  } catch (error) {
    console.log("\n❌ Failed to load configuration:", error);
  }
  
  // Test OpenAI connection
  console.log("\n3. Testing OpenAI connection...");
  const openaiConnected = await checkOpenAI();
  if (openaiConnected) {
    console.log("✅ OpenAI API is accessible");
  } else {
    console.log("❌ Failed to connect to OpenAI API");
  }
  
  // Test Pinecone connection
  console.log("\n4. Testing Pinecone connection...");
  const pineconeConnected = await checkPineconeConnection();
  if (pineconeConnected) {
    console.log("✅ Pinecone database is accessible");
    
    // Get index stats
    try {
      const { getPineconeIndex } = require("../lib/pinecone");
      const index = getPineconeIndex();
      const stats = await index.describeIndexStats();
      console.log(`   - Total vectors: ${stats.totalRecordCount || 0}`);
      console.log(`   - Dimension: ${stats.dimension || "N/A"}`);
      console.log(`   - Index fullness: ${(stats.indexFullness || 0) * 100}%`);
    } catch (error) {
      console.log("   ⚠️  Could not retrieve index statistics");
    }
  } else {
    console.log("❌ Failed to connect to Pinecone database");
  }
  
  // Overall status
  console.log("\n=== Overall Status ===");
  if (validation.valid && openaiConnected && pineconeConnected) {
    console.log("✅ All systems operational - Ready to serve!");
  } else {
    console.log("❌ Some issues detected - Please check the errors above");
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
  });
}