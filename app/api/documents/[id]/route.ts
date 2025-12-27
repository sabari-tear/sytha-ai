import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getPineconeIndex } from '@/lib/pinecone';

// GET - Fetch a specific document
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const document = await db.collection('documents').findOne({ id: params.id });
    
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

// DELETE - Delete a document and its embeddings
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    
    // Check if document exists
    const document = await db.collection('documents').findOne({ id: params.id });
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    // Delete from Pinecone if configured
    if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
      try {
        const index = getPineconeIndex();
        
        // Delete vectors with document ID filter
        await index.deleteMany({
          filter: {
            documentId: params.id
          }
        });
        console.log(`[API] Deleted vectors for document ${params.id} from Pinecone`);
      } catch (err) {
        console.error(`Error deleting vectors for document ${params.id}:`, err);
        // Continue with MongoDB deletion even if Pinecone fails
      }
    }
    
    // Delete from MongoDB
    await db.collection('documents').deleteOne({ id: params.id });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}