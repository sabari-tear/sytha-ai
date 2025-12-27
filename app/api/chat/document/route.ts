import { NextRequest, NextResponse } from 'next/server';
import { generateAnswer } from '@/lib/gemini';
import { getUserDocuments } from '../../documents/process/route';

export async function POST(request: NextRequest) {
  try {
    const { question, userId, messages } = await request.json();

    if (!question || !userId) {
      return NextResponse.json(
        { error: 'Question and userId are required' },
        { status: 400 }
      );
    }

    // Get user's uploaded documents from temporary storage
    const documentContext = getUserDocuments(userId, 'document');
    
    if (documentContext.length === 0) {
      return NextResponse.json({
        answer: 'No documents have been uploaded yet. Please upload documents first to start chatting about them.'
      });
    }

    // Create context from uploaded documents only (no legal knowledge)
    const fullContext = `
Document Content:
${documentContext.map((doc: any) => doc.content).join('\n\n')}

Based ONLY on the above document content, please answer the following question:
${question}

Important: Only use information from the uploaded documents. Do not use any external knowledge.`;

    const answer = await generateAnswer(fullContext, question);

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Document chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process document chat query' },
      { status: 500 }
    );
  }
}