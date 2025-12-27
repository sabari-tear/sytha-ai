// Simple session management using cookies
import { cookies } from 'next/headers';
import { users } from './users';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Session {
  user: User;
  expiresAt: number;
}

const SESSION_COOKIE = 'auth-session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory sessions (in production, use database)
const sessions = new Map<string, Session>();

export async function createSession(userId: string): Promise<string> {
  const user = await users.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const sessionId = generateSessionId();
  const session: Session = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    expiresAt: Date.now() + SESSION_DURATION,
  };

  sessions.set(sessionId, session);
  
  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });

  return sessionId;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }

  // Check if session expired
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  
  if (sessionId) {
    sessions.delete(sessionId);
    cookieStore.delete(SESSION_COOKIE);
  }
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}