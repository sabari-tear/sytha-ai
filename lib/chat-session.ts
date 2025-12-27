import clientPromise from "./mongodb";
import { chatSessionLogger } from "./logger";

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: any[];
};

export type ChatSession = {
  userId: string;
  sessionId: string;
  mode: 'legal' | 'case' | 'document';
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    caseId?: string;
    documentId?: string;
  };
};

/**
 * Get or create a chat session for a user
 */
export async function getOrCreateSession(
  userId: string,
  mode: 'legal' | 'case' | 'document',
  metadata?: { caseId?: string; documentId?: string }
): Promise<ChatSession> {
  try {
    const client = await clientPromise;
    const db = client.db();
    const sessions = db.collection<ChatSession>('chat_sessions');

    // Build query based on mode
    const query: any = { userId, mode };
    if (metadata?.caseId) query['metadata.caseId'] = metadata.caseId;
    if (metadata?.documentId) query['metadata.documentId'] = metadata.documentId;

    // Find existing session
    let session = await sessions.findOne(query, { sort: { updatedAt: -1 } });

    if (!session) {
      // Create new session
      const newSession: ChatSession = {
        userId,
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mode,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata
      };

      await sessions.insertOne(newSession as any);
      chatSessionLogger.info("Created new chat session", { 
        userId, 
        mode, 
        sessionId: newSession.sessionId 
      });
      
      return newSession;
    }

    chatSessionLogger.debug("Retrieved existing chat session", { 
      userId, 
      mode, 
      sessionId: session.sessionId,
      messageCount: session.messages.length
    });

    return session;
  } catch (error) {
    chatSessionLogger.error("Failed to get or create session", { 
      error: String(error), 
      userId, 
      mode 
    });
    throw error;
  }
}

/**
 * Add a message to a session
 */
export async function addMessageToSession(
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  try {
    const client = await clientPromise;
    const db = client.db();
    const sessions = db.collection<ChatSession>('chat_sessions');

    await sessions.updateOne(
      { sessionId },
      {
        $push: { messages: message as any },
        $set: { updatedAt: new Date() }
      }
    );

    chatSessionLogger.debug("Added message to session", { 
      sessionId, 
      role: message.role 
    });
  } catch (error) {
    chatSessionLogger.error("Failed to add message to session", { 
      error: String(error), 
      sessionId 
    });
    throw error;
  }
}

/**
 * Get conversation history from a session
 */
export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  try {
    const client = await clientPromise;
    const db = client.db();
    const sessions = db.collection<ChatSession>('chat_sessions');

    const session = await sessions.findOne({ sessionId });
    
    if (!session) {
      chatSessionLogger.warn("Session not found", { sessionId });
      return [];
    }

    return session.messages || [];
  } catch (error) {
    chatSessionLogger.error("Failed to get session history", { 
      error: String(error), 
      sessionId 
    });
    return [];
  }
}

/**
 * Clear all sessions for a user (called on sign out)
 */
export async function clearUserSessions(userId: string): Promise<void> {
  try {
    const client = await clientPromise;
    const db = client.db();
    const sessions = db.collection<ChatSession>('chat_sessions');

    const result = await sessions.deleteMany({ userId });
    
    chatSessionLogger.info("Cleared user sessions", { 
      userId, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    chatSessionLogger.error("Failed to clear user sessions", { 
      error: String(error), 
      userId 
    });
    throw error;
  }
}

/**
 * Get recent conversation context for RAG
 */
export async function getConversationContext(
  sessionId: string,
  maxMessages: number = 5
): Promise<string> {
  try {
    const history = await getSessionHistory(sessionId);
    
    if (!history.length) {
      return "";
    }

    // Get last N messages
    const recentMessages = history.slice(-maxMessages);
    
    // Format as context
    const context = recentMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    return context;
  } catch (error) {
    chatSessionLogger.error("Failed to get conversation context", { 
      error: String(error), 
      sessionId 
    });
    return "";
  }
}
