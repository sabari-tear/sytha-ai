import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { processDocuments } from '@/lib/rag';

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import of pdfjs-dist to avoid build issues
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    const pdf = await pdfjsLib.getDocument({ 
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.0.379/standard_fonts/'
    }).promise;
    
    const numPages = pdf.numPages;
    console.log('[API] PDF has', numPages, 'pages');
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('[API] Error parsing PDF:', error);
    throw error;
  }
}

// Helper to send SSE events
function sendEvent(controller: ReadableStreamDefaultController, data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

export async function POST(request: NextRequest) {
  console.log('[API] Document upload request received');
  
  // Check if client wants streaming response
  const wantsStream = request.headers.get('accept') === 'text/event-stream';
  
  if (wantsStream) {
    // Return streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const formData = await request.formData();
          const document = formData.get('document') as File;
          const name = formData.get('name') as string;
          const description = formData.get('description') as string;
          const userId = formData.get('userId') as string;
          
          if (!document || !name) {
            sendEvent(controller, { type: 'error', message: 'Document and name are required' });
            controller.close();
            return;
          }
          
          const effectiveUserId = userId || 'anonymous';
          const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Step 1: Extract text
          sendEvent(controller, { type: 'progress', step: 'Extracting text from document...', percent: 0 });
          
          let text = '';
          const fileExtension = document.name.split('.').pop()?.toLowerCase();
          
          if (fileExtension === 'pdf' || document.type === 'application/pdf') {
            const arrayBuffer = await document.arrayBuffer();
            text = await extractTextFromPDF(arrayBuffer);
            sendEvent(controller, { type: 'progress', step: `PDF parsed: ${text.length} characters extracted`, percent: 0 });
          } else {
            text = await document.text();
            sendEvent(controller, { type: 'progress', step: 'Text file extracted successfully', percent: 0 });
          }
          
          if (!text || text.trim().length === 0) {
            sendEvent(controller, { type: 'error', message: 'No text could be extracted' });
            controller.close();
            return;
          }
          
          // Step 2: Save to MongoDB
          sendEvent(controller, { type: 'progress', step: 'Saving document metadata to database...', percent: 0 });
          const client = await clientPromise;
          const db = client.db();
          
          const documentDoc = {
            id: docId,
            name,
            description,
            filename: document.name,
            size: document.size,
            text: text,
            userId: effectiveUserId,
            createdAt: new Date()
          };
          
          await db.collection('documents').insertOne(documentDoc);
          sendEvent(controller, { type: 'progress', step: 'Metadata saved successfully', percent: 0 });
          
          // Step 3: Embed in Pinecone
          sendEvent(controller, { type: 'progress', step: 'Preparing vector embeddings...', percent: 0 });
          
          // Process documents with progress tracking
          await processDocuments(
            text, 
            {
              documentId: docId,
              fileName: document.name,
              type: 'document',
              userId: effectiveUserId
            },
            (completed, total) => {
              const embedPercent = Math.floor((completed / total) * 100);
              sendEvent(controller, { 
                type: 'progress', 
                step: `Embedding vectors: ${completed}/${total} chunks`, 
                percent: embedPercent,
                embeddingProgress: { completed, total }
              });
            }
          );
          
          sendEvent(controller, { type: 'progress', step: 'All vectors embedded in Pinecone!', percent: 100 });
          
          // Step 4: Complete
          sendEvent(controller, { type: 'progress', step: 'Upload complete!', percent: 100 });
          sendEvent(controller, { type: 'complete', documentId: docId, data: documentDoc });
          
          controller.close();
        } catch (error) {
          console.error('[API] Streaming upload error:', error);
          sendEvent(controller, { type: 'error', message: error instanceof Error ? error.message : 'Upload failed' });
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
  
  // Non-streaming legacy response
  try {
    const formData = await request.formData();
    const document = formData.get('document') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const userId = formData.get('userId') as string;
    
    console.log('[API] Document details:', { name, userId, fileSize: document?.size, fileType: document?.type });

    if (!document || !name) {
      return NextResponse.json(
        { error: 'Document and name are required' },
        { status: 400 }
      );
    }
    
    // Use a default userId if not provided (for testing)
    const effectiveUserId = userId || 'anonymous';
    console.log('[API] Effective userId:', effectiveUserId);

    // Generate document ID
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract text based on file type
    let text = '';
    const fileExtension = document.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'pdf' || document.type === 'application/pdf') {
      // Parse PDF
      console.log('[API] Parsing PDF document...');
      const arrayBuffer = await document.arrayBuffer();
      text = await extractTextFromPDF(arrayBuffer);
      console.log('[API] PDF parsed successfully. Text length:', text.length);
    } else {
      // Handle text files
      console.log('[API] Processing text document...');
      text = await document.text();
      console.log('[API] Document text length:', text.length);
    }
    
    // Validate extracted text
    if (!text || text.trim().length === 0) {
      console.error('[API] No text could be extracted from document');
      return NextResponse.json(
        { error: 'Could not extract text from document. Please ensure the file contains readable text.' },
        { status: 400 }
      );
    }
    
    // Embed document in Pinecone for vector search
    try {
      console.log('[API] Starting Pinecone embedding...');
      await processDocuments(text, {
        documentId: docId,
        fileName: document.name,
        type: 'document',
        userId: effectiveUserId
      });
      console.log('[API] Document successfully embedded in Pinecone');
    } catch (embedError) {
      console.error('[API] Failed to embed in Pinecone:', embedError);
      throw new Error('Failed to embed document in vector database');
    }

    // Save document to MongoDB
    const client = await clientPromise;
    const db = client.db();
    
    const documentDoc = {
      id: docId,
      name,
      description,
      filename: document.name,
      size: document.size,
      text: text, // Store the full text for MongoDB-based retrieval
      userId: effectiveUserId,
      createdAt: new Date()
    };
    
    await db.collection('documents').insertOne(documentDoc);

    return NextResponse.json(documentDoc);
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}