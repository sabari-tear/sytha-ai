'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaBalanceScale, FaPaperPlane, FaRobot, FaUser, FaTrash } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';

export default function LegalKnowledgePage() {
  const { data: session } = useSession();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get userId - use email or id from session, or 'anonymous'
  const getUserId = () => {
    if (!session?.user) return 'anonymous';
    return (session.user as any).id || session.user.email || 'anonymous';
  };

  // Load messages from localStorage on mount
  useEffect(() => {
    const userId = getUserId();
    const storageKey = `legal_chat_${userId}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
      } catch (error) {
        console.error('Failed to load messages from storage:', error);
      }
    }
    setIsLoaded(true);
  }, [session]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      const userId = getUserId();
      const storageKey = `legal_chat_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, isLoaded, session]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage('');
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          mode: 'legal',
          userId: getUserId()
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear this conversation? This will clear it from your view and local storage.')) {
      setMessages([]);
      const userId = getUserId();
      const storageKey = `legal_chat_${userId}`;
      localStorage.removeItem(storageKey);
    }
  };

  const handleSignOut = async () => {
    try {
      const userId = getUserId();
      
      // Clear localStorage
      const storageKey = `legal_chat_${userId}`;
      localStorage.removeItem(storageKey);
      
      // Clear session from database before signing out
      await fetch('/api/chat/clear-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      // Sign out
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Error during sign out:', error);
      // Still sign out even if clearing session fails
      await signOut({ callbackUrl: '/' });
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl overflow-hidden h-[calc(100vh-9.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/60 px-6 py-3 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Chat</h2>
            <p className="text-xs text-slate-400">Ask natural-language questions about Indian laws and legal procedures</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-800/50"
              title="Clear chat view"
            >
              <FaTrash className="text-xs" />
              Clear
            </button>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-emerald-400">Active</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <FaBalanceScale className="text-6xl text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-50 mb-2">Start a Legal Consultation</h3>
            <p className="text-sm text-slate-400">Ask me about Indian laws, acts, sections, or legal procedures</p>
            <div className="mt-8 space-y-2">
              <p className="text-xs font-medium text-slate-500">Example questions:</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {[
                  'What is Section 498A of IPC?',
                  'Explain bail procedures in India',
                  'What are fundamental rights?',
                  'How to file a consumer complaint?'
                ].map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMessage(example)}
                    className="px-3 py-2 bg-emerald-900/30 text-emerald-300 rounded-xl text-xs hover:bg-emerald-900/50 hover:text-emerald-200 ring-1 ring-emerald-700/50 transition-all"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              <div className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-lg ${
                  msg.role === 'user' ? 'bg-brand-500' : 'bg-emerald-500'
                }`}>
                  {msg.role === 'user' ? (
                    <FaUser className="text-slate-50 text-xs" />
                  ) : (
                    <FaRobot className="text-slate-50 text-xs" />
                  )}
                </div>
                <div className={`px-4 py-3 rounded-2xl shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-brand-500 text-slate-50' 
                    : 'bg-slate-800/50 text-slate-100 ring-1 ring-slate-700/50'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          h3: ({node, ...props}) => <h3 className="text-emerald-400 font-semibold mt-3 mb-2" {...props} />,
                          h4: ({node, ...props}) => <h4 className="text-emerald-300 font-medium mt-2 mb-1" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="text-slate-200" {...props} />,
                          p: ({node, ...props}) => <p className="my-2 text-slate-200" {...props} />,
                          strong: ({node, ...props}) => <strong className="text-slate-50 font-semibold" {...props} />,
                          code: ({node, ...props}) => <code className="bg-slate-900/50 px-1.5 py-0.5 rounded text-emerald-300" {...props} />
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  <p className={`text-[11px] mt-2 ${
                    msg.role === 'user' ? 'text-brand-100' : 'text-slate-500'
                  }`}>
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <FaRobot className="text-slate-50 text-xs" />
            </div>
            <div className="bg-slate-800/50 ring-1 ring-slate-700/50 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-slate-800/60 p-3 bg-slate-900/80">
        <div className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about Indian laws..."
            className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 text-slate-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder-slate-500 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="px-6 py-3 bg-emerald-500 text-slate-50 rounded-2xl hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/40 hover:shadow-emerald-400/50"
          >
            <FaPaperPlane />
          </button>
        </div>
      </form>
    </div>
  );
}