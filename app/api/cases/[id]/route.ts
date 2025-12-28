import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getPineconeIndex } from '@/lib/pinecone';

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

export async function DELETE(
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

    if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
      try {
        const index = getPineconeIndex();
        const namespace = index.namespace('default');

        for (const docId of caseDoc.documents) {
          try {
            await namespace.deleteMany({
              filter: { documentId: docId }
            });
          } catch (err) {
            console.error(`Error deleting vectors for ${docId}:`, err);
          }
        }
      } catch (pineconeError) {
        console.error('Pinecone deletion failed:', pineconeError);
      }
    }

    await db.collection('cases').deleteOne({ id: params.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting case:', error);
    return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
  }
}
