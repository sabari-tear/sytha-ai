import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch all cases for a user
export async function GET(request: NextRequest) {
  console.log('[API/cases GET] Request received');
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    console.log('[API/cases GET] userId:', userId);
    
    if (!userId) {
      console.log('[API/cases GET] No userId provided');
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const cases = await db.collection('cases')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log('[API/cases GET] Found', cases.length, 'cases for userId:', userId);
    return NextResponse.json(cases);
  } catch (error) {
    console.error('Error fetching cases:', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}