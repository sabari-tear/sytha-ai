import { NextRequest, NextResponse } from 'next/server';
import { embedTexts } from '@/lib/embeddings';

// Store processed documents in memory (in production, use database)
const userDocumentStore = new Map<string, any[]>();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const userId = formData.get('userId') as string;
    const type = formData.get('type') as string; // 'case' or 'document'

    if (!files || files.length === 0 || !userId || !type) {
      return NextResponse.json(
        { error: 'Files, userId, and type are required' },
        { status: 400 }
      );
    }

    const processedDocuments = [];

    for (const file of files) {
      // Read file content
      const text = await file.text();
      
      // Create document chunks (simple splitting for now)
      const chunks = splitTextIntoChunks(text, 1000);
      
      // Generate embeddings for each chunk
      const embeddings = await embedTexts(chunks);
      
      // Store document with embeddings
      for (let i = 0; i < chunks.length; i++) {
        processedDocuments.push({
          fileName: file.name,
          content: chunks[i],
          embedding: embeddings[i],
          chunkIndex: i,
          totalChunks: chunks.length,
        });
      }
    }

    // Store documents for the user
    const key = `${type}_${userId}`;
    userDocumentStore.set(key, processedDocuments);

    return NextResponse.json({
      success: true,
      documentsProcessed: files.length,
      totalChunks: processedDocuments.length,
    });
  } catch (error) {
    console.error('Document processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process documents' },
      { status: 500 }
    );
  }
}

function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

// Export the store for use in chat endpoints
export function getUserDocuments(userId: string, type: string): any[] {
  const key = `${type}_${userId}`;
  return userDocumentStore.get(key) || [];
}