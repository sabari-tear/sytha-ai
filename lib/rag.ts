import { getOpenAIClient, CHAT_MODEL, EMBEDDING_MODEL, embedTexts } from "./openai";
import { getPineconeIndex } from "./pinecone";
import { ragLogger } from "./logger";

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
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
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

export async function answerLegalQuestion(question: string): Promise<ChatResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    ragLogger.warn("Empty question received");
    throw new Error("Question cannot be empty.");
  }

  ragLogger.info("Processing legal question", { 
    questionLength: trimmed.length,
    questionPreview: trimmed.substring(0, 50)
  });

  const pineconeConfigured = Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);

  if (!pineconeConfigured) {
    ragLogger.error("Pinecone is not configured - cannot answer question");
    return {
      answer:
        "The vector database is not configured on the server. Please set PINECONE_API_KEY and PINECONE_INDEX in the environment, or use the manual upload/indexing pipeline.",
      sources: [],
    };
  }

  const topDocs = await retrieveWithPinecone(trimmed, 8);

  if (!topDocs.length) {
    ragLogger.warn("No matching documents found for question");
    return {
      answer:
        "I could not find any matching sections in the vector database for this question. Please try rephrasing or check that the index is populated.",
      sources: [],
    };
  }

  ragLogger.info(`Retrieved ${topDocs.length} relevant documents for context generation`);

  const contextBlocks = topDocs.map((doc) => {
    const headerParts = [doc.act, doc.section && `Section ${doc.section}`, doc.title]
      .filter(Boolean)
      .join(" - ");
    return `${headerParts}\n\n${doc.text}`;
  });

  const context = contextBlocks.join("\n\n---\n\n");

  const client = getOpenAIClient();

  ragLogger.debug("Generating answer with OpenAI", {
    model: CHAT_MODEL,
    contextLength: context.length,
    maxTokens: 1200
  });

  const startTime = Date.now();
  
  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You are an expert Indian legal assistant (LawBot) specialising in IPC, BNS, BSA, and CrPC. You must answer strictly based on the legal CONTEXT provided. Always explain in simple language, clearly cite the relevant acts and section numbers, and include a short practical guidance section. If the context does not contain an answer, say that explicitly instead of guessing. End every answer with a short disclaimer that this is not formal legal advice. Format your response in clear Markdown with headings (e.g., '### Relevant sections', '### Explanation', '### Practical guidance', '### Disclaimer'). Whenever you list conditions, factors, steps, or pieces of guidance, ALWAYS format them as proper Markdown lists, with each item starting on its own line using '- ' for bullets or '1.' for numbered lists.",
        },
        {
          role: "user",
          content: `User question: ${trimmed}\n\nCONTEXT FROM LEGAL SECTIONS:\n${context}`,
        },
      ],
    });

    const generationTime = Date.now() - startTime;
    const answer = completion.choices?.[0]?.message?.content?.trim();
    
    ragLogger.info("Answer generated successfully", {
      generationTime: `${generationTime}ms`,
      answerLength: answer?.length || 0,
      tokensUsed: completion.usage?.total_tokens || 0
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
    ragLogger.error("Failed to generate answer with OpenAI", { error: String(error) });
    throw error;
  }
}
