import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET - Fetch all documents for a user
export async function GET(request: NextRequest) {
  console.log('[API/documents GET] Request received');
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    console.log('[API/documents GET] userId:', userId);
    
    if (!userId) {
      console.log('[API/documents GET] No userId provided');
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const documents = await db.collection('documents')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log('[API/documents GET] Found', documents.length, 'documents for userId:', userId);
    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}