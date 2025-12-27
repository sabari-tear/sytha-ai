'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CaseChatProps {
  userId: string;
}

export default function CaseChat({ userId }: CaseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [documentsProcessed, setDocumentsProcessed] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadedFiles(Array.from(files));
    }
  };

  const processDocuments = async () => {
    if (uploadedFiles.length === 0) return;

    setProcessingDocs(true);
    try {
      // Process documents (extract text and create embeddings)
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('userId', userId);
      formData.append('type', 'case');

      const response = await fetch('/api/documents/process', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setDocumentsProcessed(true);
        setMessages([{
          role: 'assistant',
          content: `Successfully processed ${uploadedFiles.length} document(s). You can now ask questions about your case documents.`
        }]);
      }
    } catch (error) {
      console.error('Error processing documents:', error);
      setMessages([{
        role: 'assistant',
        content: 'Error processing documents. Please try again.'
      }]);
    } finally {
      setProcessingDocs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !documentsProcessed) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          userId,
          messages: messages
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Case-Based Chat</h2>
        <p className="text-gray-600 text-sm mb-4">
          Upload your case documents and chat about them. The system will analyze your documents
          and answer questions based on the case content combined with legal knowledge.
        </p>

        {/* File Upload Section */}
        {!documentsProcessed && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Select Case Documents
              </button>
              {uploadedFiles.length > 0 && (
                <>
                  <span className="text-sm text-gray-600">
                    {uploadedFiles.length} file(s) selected
                  </span>
                  <button
                    onClick={processDocuments}
                    disabled={processingDocs}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {processingDocs ? 'Processing...' : 'Process Documents'}
                  </button>
                </>
              )}
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">Selected files:</p>
                <ul className="text-xs text-gray-600">
                  {uploadedFiles.map((file, index) => (
                    <li key={index}>• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <p className="text-gray-600">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={documentsProcessed ? "Ask about your case..." : "Please upload and process documents first"}
          disabled={loading || !documentsProcessed}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={loading || !documentsProcessed}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}