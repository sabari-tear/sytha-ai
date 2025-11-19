"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chat } from "@/components/Chat";

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasVectors, setHasVectors] = useState(false);

  useEffect(() => {
    checkPineconeStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkPineconeStatus = async () => {
    try {
      const response = await fetch("/api/pinecone/status");
      const data = await response.json();
      
      if (data.vectorCount === 0) {
        // No vectors, redirect to upload page
        router.push("/upload");
      } else {
        // Has vectors, show chat
        setHasVectors(true);
        setChecking(false);
      }
    } catch (error) {
      console.error("Failed to check Pinecone status:", error);
      // On error, proceed to chat anyway
      setHasVectors(true);
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-slate-300">Sytha is getting things ready...</p>
        </div>
      </div>
    );
  }

  if (!hasVectors) {
    return null; // Will redirect to upload page
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mt-4 space-y-3 text-center sm:mt-8 sm:space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-200 shadow-sm shadow-emerald-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          RAG-powered assistant
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl lg:text-5xl">
          SythaAI – Chatbot
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-sm text-slate-300 sm:text-base">
          Ask natural-language questions about offences, procedure, and evidence.
        </p>
      </header>

      <section className="mt-2 flex-1">
        <Chat />
      </section>

      <footer className="mt-6 border-t border-slate-800/70 pt-4 text-center text-[11px] text-slate-500">
        Princess Sytha might not be right all the time, Always verify important answers against the bare acts and consult a qualified lawyer when in doubt. 
      </footer>
    </main>
  );
}
