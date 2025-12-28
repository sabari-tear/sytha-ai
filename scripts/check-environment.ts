#!/usr/bin/env node

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

import { validateEnvironment, getEnvConfig } from "../lib/env";
import { checkPineconeConnection } from "../lib/pinecone";

async function main() {
  console.log("=== Environment Configuration Check ===\n");

  console.log("1. Checking environment variables...");
  const validation = validateEnvironment();

  if (validation.valid) {
    console.log("✅ Environment variables are properly configured");
  } else {
    console.log("❌ Environment configuration errors:");
    validation.errors.forEach(e => console.log(`   - ${e}`));
  }

  try {
    const config = getEnvConfig();
    console.log("\n2. Current configuration:");
    console.log(`   - Gemini Model: ${config.gemini.model}`);
    console.log(`   - Pinecone Index: ${config.pinecone.index}`);
    console.log(`   - Environment: ${config.app.nodeEnv}`);
  } catch (error) {
    console.log("\n❌ Failed to load configuration:", error);
  }

  console.log("\n3. Testing Pinecone connection...");
  const pineconeConnected = await checkPineconeConnection();

  if (pineconeConnected) {
    console.log("✅ Pinecone database is accessible");
    try {
      const { getPineconeIndex } = require("../lib/pinecone");
      const index = getPineconeIndex();
      const stats = await index.describeIndexStats();
      console.log(`   - Total vectors: ${stats.totalRecordCount || 0}`);
      console.log(`   - Dimension: ${stats.dimension || "N/A"}`);
      console.log(`   - Index fullness: ${(stats.indexFullness || 0) * 100}%`);
    } catch {
      console.log("   ⚠️  Could not retrieve index statistics");
    }
  } else {
    console.log("❌ Failed to connect to Pinecone database");
  }

  console.log("\n=== Overall Status ===");
  if (validation.valid && pineconeConnected) {
    console.log("✅ All systems operational - Ready to serve!");
  } else {
    console.log("❌ Some issues detected - Please check the errors above");
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
  });
}
