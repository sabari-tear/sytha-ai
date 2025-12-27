import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { pinecone } from '@/lib/pinecone';

// GET - Fetch a specific case
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const caseDoc = await db.collection('cases').findOne({ id: params.id });
    
    if (!caseDoc) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(caseDoc);
  } catch (error) {
    console.error('Error fetching case:', error);
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
}

// DELETE - Delete a case and its embeddings
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    
    // Get case to find document IDs
    const caseDoc = await db.collection('cases').findOne({ id: params.id });
    if (!caseDoc) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    
    // Delete from Pinecone if configured
    if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
      try {
        const index = pinecone.index('legal-docs');
        const namespace = index.namespace('default');
        
        // Delete all vectors associated with this case
        for (const docId of caseDoc.documents) {
          try {
            // Delete vectors with prefix matching the document ID
            await namespace.deleteMany({
              filter: {
                documentId: docId
              }
            });
          } catch (err) {
            console.error(`Error deleting vectors for ${docId}:`, err);
          }
        }
      } catch (pineconeError) {
        console.error('Pinecone deletion failed:', pineconeError);
        // Continue with MongoDB deletion even if Pinecone fails
      }
    }
    
    // Delete from MongoDB
    await db.collection('cases').deleteOne({ id: params.id });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting case:', error);
    return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
  }
}