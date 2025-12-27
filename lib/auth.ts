import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from './mongodb';

export const authOptions: NextAuthOptions = {
  // Remove adapter when using JWT strategy - they conflict
  // adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/', // Redirect to landing page for sign in
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      console.log('[AUTH] JWT callback triggered', { hasUser: !!user, tokenEmail: token.email });
      // On sign in, save user info to token
      if (user) {
        console.log('[AUTH] User data available in JWT', { userId: user.id, userEmail: user.email });
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      // If no id but has email, use email as id
      if (!token.id && token.email) {
        token.id = token.email;
      }
      console.log('[AUTH] JWT token after processing', { tokenId: token.id, tokenEmail: token.email });
      return token;
    },
    async session({ session, token }) {
      console.log('[AUTH] Session callback triggered', { hasToken: !!token, tokenEmail: token?.email });
      // Always populate user object from token
      if (token) {
        session.user = {
          id: (token.id as string) || (token.email as string) || (token.sub as string) || 'unknown',
          email: token.email as string,
          name: token.name as string,
          image: token.picture as string,
        };
        console.log('[AUTH] Session user populated', { userId: session.user.id, userEmail: session.user.email });
      }
      return session;
    }
  },
  debug: process.env.NODE_ENV === 'development', // Enable debug mode in development
};