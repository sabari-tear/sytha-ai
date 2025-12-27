import { embedTexts, EMBEDDING_MODEL } from "./embeddings";  // Use HuggingFace for free embeddings
import { generateAnswer, CHAT_MODEL } from "./gemini";  // Use Google Gemini for chat
import { getPineconeIndex } from "./pinecone";
import { ragLogger } from "./logger";
import clientPromise from "./mongodb";

export type SourceSnippet = {
  id: string;
  act: string;
  section?: string;
  title?: string;
  snippet: string;
};

export type ChatResult = {
  answer: string;
  sources: SourceSnippet[];
};

type IndexedDoc = {
  id: string;
  act: string;
  section?: string;
  title?: string;
  text: string;
  source: string;
  score?: number;
};

export async function initLegalIndex(): Promise<{
  indexed: boolean;
  indexedNow: boolean;
  totalDocs: number;
  pineconeConfigured: boolean;
  vectorCount?: number;
}> {
  const pineconeConfigured = Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);

  let indexed = false;
  let vectorCount = 0;

  if (pineconeConfigured) {
    try {
      const index = getPineconeIndex();
      const stats = await index.describeIndexStats();
      indexed = true;
      vectorCount = stats.totalRecordCount || 0;
      
      ragLogger.info("Successfully connected to Pinecone index", {
        index: process.env.PINECONE_INDEX,
        vectorCount,
        dimension: stats.dimension,
        indexFullness: stats.indexFullness
      });
    } catch (error) {
      ragLogger.error("Failed to read Pinecone index stats", { error: String(error) });
    }
  } else {
    ragLogger.warn("Pinecone is not configured - vector search will not be available");
  }

  return { indexed, indexedNow: false, totalDocs: vectorCount, pineconeConfigured, vectorCount };
}

async function retrieveWithPinecone(question: string, limit: number): Promise<IndexedDoc[]> {
  ragLogger.debug("Starting Pinecone retrieval", { 
    question: question.substring(0, 100), 
    limit 
  });
  
  try {
    const startTime = Date.now();
    const [queryEmbedding] = await embedTexts([question]);
    
    if (!queryEmbedding) {
      ragLogger.warn("Failed to generate query embedding for question");
      return [];
    }

    const index = getPineconeIndex();
    const namespace = index.namespace('default');
    // Only retrieve legal knowledge documents (type: 'legal')
    const queryResponse = await namespace.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
      filter: { type: 'legal' }
    });

    const matches = queryResponse.matches || [];
    const retrievalTime = Date.now() - startTime;
    
    ragLogger.info("Pinecone query completed", {
      matchCount: matches.length,
      topK: limit,
      retrievalTime: `${retrievalTime}ms`,
      topScore: matches[0]?.score || 0
    });
    
    if (!matches.length) {
      ragLogger.warn("Pinecone returned no matches for the question");
      return [];
    }

    const results: IndexedDoc[] = matches
      .map((match) => {
        const metadata = (match.metadata || {}) as any;

        const text =
          (metadata.text as string) ||
          (metadata.content as string) ||
          (metadata.body as string) ||
          "";

        return {
          id: (metadata.id as string) || (match.id as string),
          act: (metadata.act as string) || "Unknown act",
          section: metadata.section as string | undefined,
          title: metadata.title as string | undefined,
          text,
          source: (metadata.source as string) || "pinecone",
          score: match.score
        };
      })
      .filter((doc) => doc.text);

    ragLogger.debug(`Filtered ${results.length} valid documents from ${matches.length} matches`);
    return results;
  } catch (error) {
    ragLogger.error("Pinecone retrieval failed", { error: String(error) });
    return [];
  }
}

// Process and embed documents for cases or standalone documents
export async function processDocuments(
  text: string, 
  metadata: any,
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  try {
    // Split text into chunks
    const chunks = splitTextIntoChunks(text, 500, 50);
    const index = getPineconeIndex();
    const namespace = index.namespace('default');
    
    ragLogger.info("Starting document embedding", { 
      documentId: metadata.documentId,
      totalChunks: chunks.length 
    });
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const [embedding] = await embedTexts([chunk]);
      
      if (embedding) {
        const vectorId = `${metadata.documentId}_chunk_${i}`;
        await namespace.upsert([{
          id: vectorId,
          values: embedding,
          metadata: {
            ...metadata,
            text: chunk,
            chunkIndex: i,
            totalChunks: chunks.length
          }
        }]);
      }
      
      // Report progress after each chunk
      if (onProgress) {
        onProgress(i + 1, chunks.length);
      }
    }
    
    ragLogger.info("Documents processed and embedded", { 
      documentId: metadata.documentId,
      chunks: chunks.length 
    });
  } catch (error) {
    ragLogger.error("Failed to process documents", { error: String(error) });
    throw error;
  }
}

// Helper function to split text into chunks
function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  
  // Handle empty or very small text
  if (!text || text.length <= chunkSize) {
    return text ? [text] : [];
  }
  
  let start = 0;
  const maxChunks = 500; // Prevent array from getting too large
  
  while (start < text.length && chunks.length < maxChunks) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    
    // Move to next chunk
    if (end >= text.length) {
      break; // We've reached the end
    }
    
    start = Math.max(end - overlap, start + 1); // Ensure forward progress
  }
  
  ragLogger.info(`Split text into ${chunks.length} chunks from ${text.length} chars`);
  return chunks;
}

// No MongoDB fallback - Pinecone is required for all vector-based retrieval

async function retrieveWithFilter(
  question: string, 
  filter: any, 
  limit: number
): Promise<IndexedDoc[]> {
  // Pinecone is required - no fallback
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error("Pinecone is not configured. Vector search is required.");
  }
  
  try {
    const [queryEmbedding] = await embedTexts([question]);
    if (!queryEmbedding) return [];

    const index = getPineconeIndex();
    const namespace = index.namespace('default');
    const queryResponse = await namespace.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
      filter
    });

    const matches = queryResponse.matches || [];
    
    return matches.map((match) => {
      const metadata = match.metadata as any;
      return {
        id: match.id,
        act: metadata.act || metadata.fileName || "Document",
        section: metadata.section,
        title: metadata.title,
        text: metadata.text || "",
        source: metadata.type || "document",
        score: match.score
      };
    });
  } catch (error) {
    ragLogger.error("Pinecone retrieval failed", { error: String(error) });
    throw error; // No fallback - fail if Pinecone fails
  }
}

export async function answerLegalQuestion(
  question: string,
  conversationHistory?: string
): Promise<ChatResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    ragLogger.warn("Empty question received");
    throw new Error("Question cannot be empty.");
  }

  ragLogger.info("Processing legal question", { 
    questionLength: trimmed.length,
    questionPreview: trimmed.substring(0, 50),
    hasHistory: !!conversationHistory
  });

  const pineconeConfigured = Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);

  if (!pineconeConfigured) {
    ragLogger.warn("Pinecone is not configured - providing general legal knowledge");
    // Still try to answer the question using Gemini's general knowledge
    const systemPrompt = "You are an expert Indian legal assistant. Answer questions about Indian laws, acts, sections, and legal procedures using your knowledge. Be accurate and cite relevant laws when possible.";
    const historyContext = conversationHistory ? `\n\nPREVIOUS CONVERSATION:\n${conversationHistory}\n\n` : "";
    const userPrompt = `${historyContext}Legal Question: ${trimmed}\n\nPlease provide information about this legal question based on Indian law.`;
    
    try {
      const answer = await generateAnswer(systemPrompt, userPrompt);
      return {
        answer: answer || "Unable to generate answer.",
        sources: [{
          id: "general",
          act: "General Legal Knowledge",
          snippet: "Response based on AI's general legal knowledge (no specific document retrieval)"
        }]
      };
    } catch (error) {
      ragLogger.error("Failed to generate answer", { error: String(error) });
      return {
        answer: "I'm unable to answer this question at the moment. Please try again later.",
        sources: []
      };
    }
  }

  const topDocs = await retrieveWithPinecone(trimmed, 8);

  if (!topDocs.length) {
    ragLogger.warn("No matching documents found for question - using Gemini general knowledge fallback");
    // Fallback to Gemini's general knowledge if no docs found
    const systemPrompt = "You are an expert Indian legal assistant. Answer questions about Indian laws, acts, sections, and legal procedures using your knowledge. Be accurate and cite relevant laws when possible. If you don't know the answer, say so clearly.";
    const historyContext = conversationHistory ? `\n\nPREVIOUS CONVERSATION:\n${conversationHistory}\n\n` : "";
    const userPrompt = `${historyContext}Legal Question: ${trimmed}\n\nPlease provide information about this legal question based on Indian law. If you cannot provide a confident answer, please state that clearly.`;
    
    try {
      const answer = await generateAnswer(systemPrompt, userPrompt);
      return {
        answer: answer || "I'm unable to find specific information about this in our legal database. Please try rephrasing your question or consult a legal professional.",
        sources: [{
          id: "gemini_fallback",
          act: "General Legal Knowledge (AI)",
          snippet: "Response generated using Gemini AI's general legal knowledge. For specific legal advice, please consult a qualified legal professional."
        }]
      };
    } catch (error) {
      ragLogger.error("Failed to generate answer with Gemini fallback", { error: String(error) });
      return {
        answer: "I'm unable to answer this question at the moment. Please try again later or rephrase your question.",
        sources: []
      };
    }
  }

  ragLogger.info(`Retrieved ${topDocs.length} relevant documents for context generation`);

  const contextBlocks = topDocs.map((doc) => {
    const headerParts = [doc.act, doc.section && `Section ${doc.section}`, doc.title]
      .filter(Boolean)
      .join(" - ");
    return `${headerParts}\n\n${doc.text}`;
  });

  const context = contextBlocks.join("\n\n---\n\n");

  ragLogger.debug("Generating answer with Gemini", {
    model: CHAT_MODEL,
    contextLength: context.length,
    maxTokens: 1200
  });

  const startTime = Date.now();
  
  try {
    const systemPrompt = "You are an expert Indian legal assistant (LawBot) specialising in IPC, BNS, BSA, and CrPC. You must answer strictly based on the legal CONTEXT provided. Always explain in simple language, clearly cite the relevant acts and section numbers, and include a short practical guidance section. If the context does not contain an answer, say that explicitly instead of guessing. End every answer with a short disclaimer that this is not formal legal advice. Format your response in clear Markdown with headings (e.g., '### Relevant sections', '### Explanation', '### Practical guidance', '### Disclaimer'). Whenever you list conditions, factors, steps, or pieces of guidance, ALWAYS format them as proper Markdown lists, with each item starting on its own line using '- ' for bullets or '1.' for numbered lists.";
    
    const historyContext = conversationHistory ? `\n\nPREVIOUS CONVERSATION:\n${conversationHistory}\n\n` : "";
    const userPrompt = `${historyContext}User question: ${trimmed}\n\nCONTEXT FROM LEGAL SECTIONS:\n${context}`;
    
    const answer = await generateAnswer(systemPrompt, userPrompt);
    const generationTime = Date.now() - startTime;
    
    ragLogger.info("Answer generated successfully with Gemini", {
      generationTime: `${generationTime}ms`,
      answerLength: answer?.length || 0
    });

  const sources: SourceSnippet[] = topDocs.map((doc) => ({
    id: doc.id,
    act: doc.act,
    section: doc.section,
    title: doc.title,
    snippet: doc.text.slice(0, 280),
  }));

    return {
      answer:
        answer ||
        "I was unable to generate a detailed answer from the dataset and model. Please try asking your question again with more context.",
      sources,
    };
  } catch (error) {
    ragLogger.error("Failed to generate answer with Gemini", { error: String(error) });
    throw error;
  }
}

// Answer questions about a specific case (combines case documents + legal knowledge)
export async function answerCaseQuestion(
  question: string, 
  caseId: string
): Promise<ChatResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question cannot be empty.");
  }

  ragLogger.info("Processing case question", { caseId, question: trimmed.substring(0, 50) });

  // Get case-specific documents
  const caseFilter = { caseId };
  const caseDocs = await retrieveWithFilter(trimmed, caseFilter, 5);
  
  // Also get relevant legal knowledge (if Pinecone is configured)
  let legalDocs: IndexedDoc[] = [];
  const pineconeConfigured = Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
  if (pineconeConfigured) {
    try {
      legalDocs = await retrieveWithPinecone(trimmed, 3);
    } catch (error) {
      ragLogger.warn("Failed to retrieve legal docs, continuing with case docs only", { error: String(error) });
    }
  }
  
  // Combine both contexts
  const allDocs = [...caseDocs, ...legalDocs];
  
  if (!allDocs.length) {
    return {
      answer: "I couldn't find relevant information for this case question. Please ensure the case documents are uploaded.",
      sources: [],
    };
  }

  const contextBlocks = allDocs.map((doc) => {
    const headerParts = [doc.act, doc.section && `Section ${doc.section}`, doc.title]
      .filter(Boolean)
      .join(" - ");
    return `${headerParts}\n\n${doc.text}`;
  });

  const context = contextBlocks.join("\n\n---\n\n");
  
  const systemPrompt = "You are an expert legal assistant analyzing a specific case. Use BOTH the case documents AND relevant legal knowledge to provide comprehensive analysis. Cite specific parts of the case documents when relevant, and reference applicable laws and sections. Format your response clearly with headings.";
  
  const userPrompt = `Case Question: ${trimmed}\n\nCONTEXT (Case Documents + Legal Knowledge):\n${context}`;
  
  try {
    const answer = await generateAnswer(systemPrompt, userPrompt);
    const sources = allDocs.map((doc) => ({
      id: doc.id,
      act: doc.act,
      section: doc.section,
      title: doc.title,
      snippet: doc.text.slice(0, 280),
    }));

    return { answer: answer || "Unable to generate answer.", sources };
  } catch (error) {
    ragLogger.error("Failed to answer case question", { error: String(error) });
    throw error;
  }
}

// Answer questions about a specific document (no legal knowledge)
export async function answerDocumentQuestion(
  question: string,
  documentId: string
): Promise<ChatResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question cannot be empty.");
  }

  ragLogger.info("Processing document question", { documentId, question: trimmed.substring(0, 50) });

  // Only get document-specific content
  const docFilter = { documentId };
  const docs = await retrieveWithFilter(trimmed, docFilter, 8);
  
  if (!docs.length) {
    return {
      answer: "I couldn't find the document content. Please ensure the document is uploaded and processed.",
      sources: [],
    };
  }

  const contextBlocks = docs.map((doc) => doc.text);
  const context = contextBlocks.join("\n\n---\n\n");
  
  const systemPrompt = "You are a helpful assistant analyzing a specific document. Answer questions based ONLY on the document content provided. Do not add external legal knowledge. Be precise and cite relevant parts of the document.";
  
  const userPrompt = `Document Question: ${trimmed}\n\nDOCUMENT CONTENT:\n${context}`;
  
  try {
    const answer = await generateAnswer(systemPrompt, userPrompt);
    const sources = docs.map((doc) => ({
      id: doc.id,
      act: doc.act,
      section: doc.section,
      title: doc.title,
      snippet: doc.text.slice(0, 280),
    }));

    return { answer: answer || "Unable to generate answer.", sources };
  } catch (error) {
    ragLogger.error("Failed to answer document question", { error: String(error) });
    throw error;
  }
}
