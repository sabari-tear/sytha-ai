import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SythaAI – Legal Chatbot",
  description:
    "A RAG-powered Indian legal assistant that answers questions using IPC, BNS, BSA, and CrPC sections.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen text-slate-100 overflow-x-hidden">
        <div className="fixed inset-0 bg-[#0a0e1a] -z-10" />
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-950/20 via-transparent to-purple-950/20 -z-10" />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
