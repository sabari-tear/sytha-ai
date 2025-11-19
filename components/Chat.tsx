"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { SourceSnippet } from "@/lib/rag";
import { clsx } from "clsx";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: SourceSnippet[];
};

type ParsedBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function stripEmphasis(text: string): string {
  // Remove **strong** and *emphasis* markers for cleaner display
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}

function parseAssistantContent(text: string): ParsedBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];

  let currentParagraph: string[] = [];
  let currentList: string[] | null = null;

  const flushParagraph = () => {
    if (currentParagraph.length) {
      blocks.push({ type: "paragraph", text: currentParagraph.join(" ") });
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList && currentList.length) {
      blocks.push({ type: "list", items: currentList.map(stripEmphasis) });
      currentList = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const headingText = stripEmphasis(headingMatch[2].trim());
      if (headingText) {
        blocks.push({ type: "heading", text: headingText });
      }
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.*)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    const listMatch = bulletMatch || orderedMatch;
    if (listMatch) {
      flushParagraph();
      if (!currentList) currentList = [];
      currentList.push(listMatch[1].trim());
      continue;
    }

    // Continuation lines: attach to last list item if a list is open, otherwise paragraph
    if (currentList) {
      const lastIndex = currentList.length - 1;
      currentList[lastIndex] = `${currentList[lastIndex]} ${line}`;
    } else {
      currentParagraph.push(line);
    }
  }

  flushParagraph();
  flushList();

  return blocks;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      content:
        "Namaste! I am your Indian legal assistant. Ask me about criminal law, procedure, evidence, or specific sections under IPC, BNS, BSA, or CrPC.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSourcesForId, setExpandedSourcesForId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Something went wrong while contacting the legal assistant.");
      }

      const data = (await res.json()) as { answer: string; sources: SourceSnippet[] };

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "assistant",
          content:
            "I ran into a technical issue while answering your question. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] items-start">
      <section className="flex flex-col rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl">
        <header className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-slate-300">
              Chat
            </h2>
            <p className="text-xs text-slate-400">
              Ask questions about Indian criminal law, procedure, and evidence.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Online
          </div>
        </header>

        <div
          ref={scrollRef}
          className="chat-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 max-h-[60vh]"
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className={clsx("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role === "assistant" && (
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/90 text-xs font-semibold shadow-lg shadow-brand-500/40">
                  SE
                </div>
              )}

              <div
                className={clsx(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md",
                  message.role === "user"
                    ? "bg-brand-500 text-slate-50 shadow-brand-500/40"
                    : "bg-slate-900/80 text-slate-100 ring-1 ring-slate-700/80",
                )}
              >
                {message.role === "assistant" ? (
                  <>
                    <div className="space-y-2 text-sm leading-relaxed">
                      {parseAssistantContent(message.content).map((block, index) => {
                        if (block.type === "heading") {
                          return (
                            <p key={index} className="font-semibold text-slate-100">
                              {block.text}
                            </p>
                          );
                        }
                        if (block.type === "list") {
                          return (
                            <ul key={index} className="ml-5 list-disc space-y-1 text-slate-200">
                              {block.items.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          );
                        }
                        return (
                          <p key={index} className="text-slate-100">
                            {block.text}
                          </p>
                        );
                      })}
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSourcesForId((current) =>
                              current === message.id ? null : message.id,
                            )
                          }
                          className="text-xs font-medium text-brand-300 hover:text-brand-200 underline-offset-2 hover:underline"
                        >
                          {expandedSourcesForId === message.id
                            ? "Hide referenced sections"
                            : "Show referenced sections"}
                        </button>

                        {expandedSourcesForId === message.id && (
                          <div className="mt-2 border-t border-slate-700/70 pt-2 text-xs text-slate-300">
                            <ul className="space-y-1">
                              {message.sources.map((source) => (
                                <li key={source.id} className="flex flex-col">
                                  <span className="font-medium">
                                    {source.act}
                                    {source.section ? ` – Section ${source.section}` : ""}
                                    {source.title ? `: ${source.title}` : ""}
                                  </span>
                                  <span className="line-clamp-2 text-slate-400">
                                    {source.snippet}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

              </div>

              {message.role === "user" && (
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100 shadow-lg">
                  You
                </div>
              )}
            </article>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:0.12s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:0.24s]" />
              <span className="ml-1">Thinking about relevant sections…</span>
            </div>
          )}

          {error && (
            <div className="mt-2 text-xs text-rose-300">{error}</div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border-t border-slate-800/60 bg-slate-900/70 px-4 py-3 sm:flex-row sm:items-center sm:px-6"
        >
          <div className="flex-1">
            <input
              type="text"
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/70 px-4 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 shadow-inner shadow-slate-950/60 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
              placeholder="Describe your situation…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="inline-flex items-center justify-center rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-slate-50 shadow-lg shadow-brand-500/40 transition hover:bg-brand-400 hover:shadow-brand-400/50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
          >
            {isLoading ? "Answering…" : "Ask SythaAI"}
          </button>
        </form>
      </section>

      <aside className="hidden flex-col gap-3 rounded-3xl border border-slate-800/60 bg-slate-950/50 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl lg:flex">
        <h3 className="text-sm font-semibold text-slate-200">Example questions</h3>
        <ul className="space-y-2 text-xs text-slate-400">
          <li>• What is the punishment for theft under the Indian Penal Code?</li>
          <li>• What sections apply if someone threatens me with physical harm?</li>
          <li>• How is cheating defined under BNS and what is the punishment?</li>
          <li>• What are my rights and the police procedure during arrest?</li>
          <li>• Under BSA, what rules apply to electronic records as evidence?</li>
        </ul>
        <div className="mt-3 rounded-2xl bg-slate-900/70 p-3 text-[11px] leading-relaxed text-slate-400 ring-1 ring-slate-700/70">
          <p className="font-semibold text-slate-200">Disclaimer</p>
          <p>
            This chatbot provides general legal information based on Indian statutes. It is not a
            substitute for professional legal advice. For any critical matter, consult a qualified
            advocate.
          </p>
        </div>
      </aside>
    </div>
  );
}
