import { NextRequest, NextResponse } from 'next/server';
import { processDocuments } from '@/lib/rag';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// Extract text from PDF
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\\n';
  }

  return fullText.trim();
}

export async function POST(request: NextRequest) {
  console.log('[API] Legal knowledge upload request received');
  
  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  const streaming = formData.get('streaming') === 'true';
  
  console.log('[API] Upload details:', { filesCount: files.length, streaming });

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'At least one file is required' },
      { status: 400 }
    );
  }
  
  // If streaming is enabled, use SSE
  if (streaming) {
    const stream = new ReadableStream({
      async start(controller) {
        const textEncoder = new TextEncoder();
        
        const send = (data: any) => {
          controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(data)}\\n\\n`));
        };

        try {
          send({ type: 'progress', step: 'Extracting text from files', percent: 0 });
          
          const fileTexts: { fileName: string; text: string; }[] = [];
          
          // Extract text from all files
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            send({ type: 'progress', step: `Processing ${file.name} (${i + 1}/${files.length})`, percent: 0 });
            
            let text: string;
            if (file.type === 'application/pdf') {
              text = await extractTextFromPDF(file);
              send({ type: 'progress', step: `PDF parsed: ${text.length} characters extracted`, percent: 0 });
            } else {
              text = await file.text();
            }
            
            fileTexts.push({ fileName: file.name, text });
          }
          
          send({ type: 'progress', step: `Parsed ${files.length} files`, percent: 0 });
          
          // Embed documents if Pinecone is configured
          if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
            const totalFiles = fileTexts.length;
            let completedFiles = 0;
            
            for (const fileData of fileTexts) {
              await processDocuments(
                fileData.text,
                {
                  fileName: fileData.fileName,
                  type: 'legal',
                  source: 'user-upload',
                  uploadedAt: new Date().toISOString()
                },
                (completed, total) => {
                  const overallCompleted = completedFiles + (completed / total);
                  const percent = Math.round((overallCompleted / totalFiles) * 100);
                  send({ 
                    type: 'progress', 
                    step: `Embedding vectors: ${Math.round(overallCompleted)}/${totalFiles} files`, 
                    percent,
                    embeddingProgress: true
                  });
                }
              );
              completedFiles++;
            }
          } else {
            send({ type: 'error', message: 'Pinecone is not configured. Cannot upload legal knowledge.' });
            controller.close();
            return;
          }
          
          send({ type: 'complete', filesCount: files.length });
          controller.close();
        } catch (error) {
          console.error('[Legal Upload] Error:', error);
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
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
      return NextResponse.json(
        { error: 'Pinecone is not configured' },
        { status: 500 }
      );
    }

    for (const file of files) {
      let text: string;
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else {
        text = await file.text();
      }
      
      await processDocuments(text, {
        fileName: file.name,
        type: 'legal',
        source: 'user-upload',
        uploadedAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Uploaded ${files.length} files successfully` 
    });
  } catch (error) {
    console.error('Error uploading legal knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to upload legal knowledge' },
      { status: 500 }
    );
  }
}
