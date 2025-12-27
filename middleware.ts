export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    // Protect the chat and admin routes
    '/chat/:path*',
    '/admin/:path*',
  ],
};