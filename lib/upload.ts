import { embedTexts } from "./openai";
import { getPineconeIndex } from "./pinecone";
import { indexLogger } from "./logger";

export type UploadedDoc = {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
};

function chunkText(text: string, maxChars = 1500): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start = end;
  }

  return chunks;
}

export function chunkFileText(fileName: string, rawText: string): UploadedDoc[] {
  const baseId = `${Date.now()}_${fileName.replace(/\s+/g, "_")}`;
  const chunks = chunkText(rawText);

  return chunks.map((chunk, index) => ({
    id: `${baseId}_chunk_${index + 1}`,
    text: chunk,
    metadata: {
      source: "upload",
      fileName,
      chunkIndex: index + 1,
      totalChunks: chunks.length,
      uploadedAt: new Date().toISOString(),
    },
  }));
}

export async function uploadDocumentsToPinecone(docs: UploadedDoc[]): Promise<{
  uploadedChunks: number;
  errors?: string[];
}> {
  if (!docs.length) {
    indexLogger.warn("No documents provided for upload");
    return { uploadedChunks: 0 };
  }

  indexLogger.info(`Starting upload of ${docs.length} documents to Pinecone`);
  
  const index = getPineconeIndex();
  const batchSize = 50;
  let uploadedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    try {
      indexLogger.debug(`Processing batch ${batchNum} (${batch.length} documents)`);
      
      const embeddings = await embedTexts(batch.map((doc) => doc.text));

      const vectors = batch.map((doc, idx) => ({
        id: doc.id,
        values: embeddings[idx],
        metadata: {
          ...doc.metadata,
          text: doc.text.substring(0, 2000), // Limit text in metadata
        },
      }));

      await index.upsert(vectors);
      uploadedCount += batch.length;
      
      indexLogger.info(`Batch ${batchNum} uploaded successfully`, {
        batchSize: batch.length,
        totalUploaded: uploadedCount
      });
      
      // Add small delay to avoid rate limiting
      if (i + batchSize < docs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      const errorMsg = `Failed to upload batch ${batchNum}: ${error}`;
      indexLogger.error(errorMsg, { error: String(error) });
      errors.push(errorMsg);
    }
  }

  if (errors.length > 0) {
    indexLogger.warn(`Upload completed with ${errors.length} errors`, { errors });
  } else {
    indexLogger.info(`Successfully uploaded all ${uploadedCount} documents`);
  }

  return { 
    uploadedChunks: uploadedCount,
    errors: errors.length > 0 ? errors : undefined
  };
}
