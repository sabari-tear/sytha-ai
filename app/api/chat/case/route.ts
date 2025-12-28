import { NextRequest, NextResponse } from 'next/server';
import { generateAnswer } from '@/lib/gemini';
import { embedTexts } from '@/lib/embeddings';
import { getPineconeClient } from '@/lib/pinecone';
import { getUserDocuments } from '@/lib/documentStore';


export async function POST(request: NextRequest) {
  try {
    const { question, userId, messages } = await request.json();

    if (!question || !userId) {
      return NextResponse.json(
        { error: 'Question and userId are required' },
        { status: 400 }
      );
    }

    // Get user's case documents from temporary storage
    const caseContext = getUserDocuments(userId, 'case');
    
    // Also search legal knowledge base for relevant context
    const embedding = await embedTexts([question]);
    const pinecone = await getPineconeClient();
    const index = pinecone.index('legal-docs');
    
    const queryResponse = await index.namespace('legal-statutes').query({
      vector: embedding[0],
      topK: 3,
      includeMetadata: true,
    });

    const legalContext = queryResponse.matches
      .map((match: any) => match.metadata?.content || '')
      .join('\n\n');

    // Combine case documents with legal context
    const fullContext = `
Case Documents Context:
${caseContext.map((doc: any) => doc.content).join('\n\n')}

Related Legal Context:
${legalContext}

Based on the above case documents and legal context, please answer the following question:
${question}

Provide a comprehensive analysis considering both the specific case details and relevant legal provisions.`;

    const answer = await generateAnswer(fullContext, question);

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Case chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process case chat query' },
      { status: 500 }
    );
  }
}