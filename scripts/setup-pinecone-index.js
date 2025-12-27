/**
 * Script to create a new Pinecone index with correct dimensions for HuggingFace embeddings
 * Run this with: node scripts/setup-pinecone-index.js
 */

const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = 'legal-documents'; // New index name
const DIMENSION = 384; // HuggingFace sentence-transformers/all-MiniLM-L6-v2 dimension

async function setupPineconeIndex() {
  console.log('🚀 Setting up Pinecone index...');
  
  if (!PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    const pinecone = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });

    console.log('📋 Listing existing indexes...');
    const indexes = await pinecone.listIndexes();
    const existingIndex = indexes.indexes?.find(idx => idx.name === INDEX_NAME);

    if (existingIndex) {
      console.log(`✅ Index "${INDEX_NAME}" already exists with dimension ${existingIndex.dimension}`);
      
      if (existingIndex.dimension !== DIMENSION) {
        console.log(`⚠️  WARNING: Existing index has dimension ${existingIndex.dimension}, but we need ${DIMENSION}`);
        console.log('You have two options:');
        console.log('1. Delete the existing index and create a new one');
        console.log('2. Use a different index name in .env file');
        process.exit(1);
      }
    } else {
      console.log(`📝 Creating new index "${INDEX_NAME}" with dimension ${DIMENSION}...`);
      
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: DIMENSION,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      console.log('⏳ Waiting for index to be ready...');
      // Wait for index to be ready
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds
      
      console.log(`✅ Index "${INDEX_NAME}" created successfully!`);
    }

    console.log('\n📝 Next steps:');
    console.log(`1. Update your .env file: PINECONE_INDEX=${INDEX_NAME}`);
    console.log('2. Restart your development server');
    console.log('3. Upload documents to start using vector search\n');

  } catch (error) {
    console.error('❌ Error setting up Pinecone:', error.message);
    process.exit(1);
  }
}

setupPineconeIndex();
