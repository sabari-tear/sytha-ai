import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { processDocuments } from '@/lib/rag';

// Helper to send SSE events
function sendEvent(writer: WritableStreamDefaultWriter, data: any) {
  const encoder = new TextEncoder();
  writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

export async function POST(request: NextRequest) {
  console.log('[API] Case creation request received');
  
  const formData = await request.formData();
  const caseName = formData.get('caseName') as string;
  const caseDescription = formData.get('caseDescription') as string;
  const userId = formData.get('userId') as string;
  const documents = formData.getAll('documents') as File[];
  const streaming = formData.get('streaming') === 'true';
  
  console.log('[API] Case details:', { caseName, userId, documentsCount: documents.length, streaming });

  if (!caseName || documents.length === 0) {
    return NextResponse.json(
      { error: 'Case name and documents are required' },
      { status: 400 }
    );
  }
  
  // Use a default userId if not provided (for testing)
  const effectiveUserId = userId || 'anonymous';

  // Generate case ID
  const caseId = `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // If streaming is enabled, use SSE
  if (streaming) {
    const stream = new ReadableStream({
      async start(controller) {
        const writer = controller;
        const textEncoder = new TextEncoder();
        
        const send = (data: any) => {
          controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send({ type: 'progress', step: 'Extracting text from documents', percent: 0 });
          
          const documentIds: string[] = [];
          const documentTexts: { id: string; name: string; text: string; }[] = [];
          
          // Extract text from all files
          for (let i = 0; i < documents.length; i++) {
            const file = documents[i];
            send({ type: 'progress', step: `Processing ${file.name} (${i + 1}/${documents.length})`, percent: 0 });
            
            const text = await file.text();
            const docId = `${caseId}_${file.name}`;
            documentIds.push(docId);
            documentTexts.push({ id: docId, name: file.name, text });
          }
          
          send({ type: 'progress', step: `Parsed ${documents.length} documents`, percent: 0 });
          send({ type: 'progress', step: 'Saving case metadata', percent: 0 });
          
          // Save case to MongoDB
          const client = await clientPromise;
          const db = client.db();
          
          const caseDoc = {
            id: caseId,
            name: caseName,
            description: caseDescription,
            documents: documentIds,
            documentTexts,
            userId: effectiveUserId,
            createdAt: new Date()
          };
          
          await db.collection('cases').insertOne(caseDoc);
          
          // Embed documents if Pinecone is configured
          if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
            const totalChunks = documents.length;
            let completedChunks = 0;
            
            for (const docText of documentTexts) {
              await processDocuments(
                docText.text,
                {
                  caseId,
                  documentId: docText.id,
                  fileName: docText.name,
                  type: 'case',
                  userId: effectiveUserId
                },
                (completed, total) => {
                  const overallCompleted = completedChunks + (completed / total);
                  const percent = Math.round((overallCompleted / totalChunks) * 100);
                  send({ 
                    type: 'progress', 
                    step: `Embedding vectors: ${Math.round(overallCompleted)}/${totalChunks} documents`, 
                    percent,
                    embeddingProgress: true
                  });
                }
              );
              completedChunks++;
            }
          }
          
          send({ type: 'complete', caseId });
          controller.close();
        } catch (error) {
          console.error('[Case Create] Error:', error);
          send({ type: 'error', message: error instanceof Error ? error.message : 'Upload failed' });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
  
  // Legacy non-streaming response
  try {
    const documentIds: string[] = [];
    const documentTexts: { id: string; name: string; text: string; }[] = [];
    
    for (const file of documents) {
      const text = await file.text();
      const docId = `${caseId}_${file.name}`;
      documentIds.push(docId);
      documentTexts.push({ id: docId, name: file.name, text });
      
      if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
        try {
          await processDocuments(text, {
            caseId,
            documentId: docId,
            fileName: file.name,
            type: 'case',
            userId: effectiveUserId
          });
        } catch (embedError) {
          console.error('[API] Failed to embed document:', file.name, embedError);
        }
      }
    }

    const client = await clientPromise;
    const db = client.db();
    
    const caseDoc = {
      id: caseId,
      name: caseName,
      description: caseDescription,
      documents: documentIds,
      documentTexts,
      userId: effectiveUserId,
      createdAt: new Date()
    };
    
    await db.collection('cases').insertOne(caseDoc);
    return NextResponse.json(caseDoc);
  } catch (error) {
    console.error('Error creating case:', error);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}