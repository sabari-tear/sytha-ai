import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SythaAI – Chatbot",
  description:
    "A RAG-powered Indian legal assistant that answers questions using IPC, BNS, BSA, and CrPC sections.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
