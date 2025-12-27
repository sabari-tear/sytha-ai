'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FaFolder, FaPlus, FaTrash, FaFileAlt, FaClock, FaUpload } from 'react-icons/fa';

interface Document {
  id: string;
  name: string;
  description: string;
  filename: string;
  size: number;
  createdAt: Date;
  userId: string;
}

export default function DocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  const [sessionError, setSessionError] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [completedDocId, setCompletedDocId] = useState<string>('');
  
  // Debug session
  useEffect(() => {
    console.log('[Documents Page] Session status:', status);
    console.log('[Documents Page] Session data:', JSON.stringify(session, null, 2));
    
    // Check if session is broken (authenticated but no user)
    if (status === 'authenticated' && !session?.user) {
      console.error('[Documents Page] Session broken - user is null');
      setSessionError(true);
      setLoading(false);
    }
  }, [session, status]);
  
  // Form state
  const [docName, setDocName] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      fetchDocuments();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, session?.user?.email]); // Depend on both status and email

  const fetchDocuments = async () => {
    if (!session?.user?.email) {
      console.log('[Fetch] No user email available, skipping fetch');
      setLoading(false);
      return;
    }
    
    setLoading(true); // Set loading when starting fetch
    const userId = session.user.email;  // Always use email as userId
    console.log('[Fetch] Fetching documents for userId:', userId);
    
    try {
      const url = `/api/documents?userId=${encodeURIComponent(userId)}`;
      console.log('[Fetch] Requesting:', url);
      const response = await fetch(url);
      console.log('[Fetch] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Fetch] Documents received:', data.length, 'documents');
        setDocuments(data);
      } else {
        const error = await response.text();
        console.error('[Fetch] Error response:', error);
      }
    } catch (error) {
      console.error('[Fetch] Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!docName) {
        setDocName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadDocument = async () => {
    console.log('[Upload] Starting upload...', { 
      docName, 
      fileName: selectedFile?.name,
      sessionStatus: status,
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email
    });
    
    if (!selectedFile || !docName) {
      alert('Please provide a document name and select a file');
      return;
    }
    
    const userId = session?.user?.email || 'anonymous';
    console.log('[Upload] Using userId:', userId);
    
    // Start upload and close the input modal
    setUploading(true);
    setShowUploadModal(false);
    setUploadProgress('Preparing upload...');
    setUploadPercent(0);
    setProcessingSteps(['📄 Preparing upload...']);
    
    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('name', docName);
      formData.append('description', docDescription);
      formData.append('userId', userId);

      // Use EventSource for streaming progress
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
        },
        body: formData
      });

      if (!response.ok || !response.body) {
        throw new Error('Upload failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let documentId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                // Only update progress bar for embedding vectors
                if (data.embeddingProgress) {
                  // Embedding phase: update progress bar and status text
                  setUploadProgress(data.step);
                  setUploadPercent(data.percent);
                } else {
                  // Other steps: only update status text, keep progress bar at 0
                  setUploadProgress(data.step);
                  setUploadPercent(0);
                }
                // No logs for any steps
              } else if (data.type === 'complete') {
                documentId = data.documentId;
                setCompletedDocId(documentId);
                setUploadPercent(100);
                setProcessingSteps(prev => [...prev, '✅ Complete!']);
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (e) {
              console.error('[Upload] Parse error:', e);
            }
          }
        }
      }

      // Document upload complete - no auto-redirect
      // User must manually click to open the document
    } catch (error) {
      console.error('[Upload] Error:', error);
      setUploadProgress('Failed');
      setProcessingSteps(prev => [...prev, '❌ Upload failed']);
      alert(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUploadProgress('');
      setProcessingSteps([]);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setDocuments(documents.filter(d => d.id !== docId));
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Show loading while session is being fetched
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  // Show session error with instructions
  if (sessionError) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">Session Error Detected</h2>
          <p className="text-red-700 mb-6">
            Your session needs to be refreshed to work properly. This is a one-time fix.
          </p>
          <div className="bg-white rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold text-gray-800 mb-3">To fix this:</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Click the <strong>"Sign Out"</strong> button in the sidebar</li>
              <li>Sign in again with your Google account</li>
              <li>Come back to this page</li>
            </ol>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Sign Out Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl overflow-hidden h-[calc(100vh-9.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/60 px-6 py-3 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Document Chat</h2>
            <p className="text-xs text-slate-400">Upload and chat with individual documents</p>
          </div>
        </div>
        <div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-slate-50 rounded-xl hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/40 hover:shadow-blue-400/50 text-sm font-semibold"
          >
            <FaPlus />
            Upload Document
          </button>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="flex-1 overflow-y-auto chat-scroll p-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-slate-400">Loading documents...</div>
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl p-12 text-center">
          <FaFolder className="text-6xl text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-50 mb-2">No Documents Yet</h3>
          <p className="text-sm text-slate-400 mb-6">Upload your first document to start chatting</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-slate-50 rounded-2xl hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/40 hover:shadow-blue-400/50 text-sm font-semibold"
          >
            <FaPlus />
            Upload Your First Document
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl hover:border-slate-700/80 transition-all duration-300 overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500 rounded-2xl text-slate-50 shadow-lg shadow-blue-500/40">
                      <FaFileAlt className="text-xl" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base text-slate-50 truncate">{doc.name}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <FaClock className="text-xs" />
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FaTrash />
                  </button>
                </div>
                
                <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                  {doc.description || 'No description provided'}
                </p>
                
                <div className="flex items-center justify-between mb-4 text-xs text-slate-400">
                  <div>
                    <span className="font-medium">{formatFileSize(doc.size)}</span>
                  </div>
                  <div className="truncate max-w-[150px]">
                    {doc.filename}
                  </div>
                </div>
                
                <button
                  onClick={() => router.push(`/chat/documents/${doc.id}`)}
                  className="w-full py-2.5 bg-blue-500 text-slate-50 rounded-2xl hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/40 hover:shadow-blue-400/50 text-sm font-semibold"
                >
                  Open Document Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal - Input Form */}
      {showUploadModal && !uploading && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-3xl border border-slate-800/60 bg-slate-900 shadow-[0_0_60px_rgba(15,23,42,0.8)] p-8 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-semibold mb-6 text-slate-50">Upload Document</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Document Name *
                </label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 text-slate-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder-slate-500"
                  placeholder="e.g., Contract Agreement"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Description
                </label>
                <textarea
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 text-slate-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none text-sm placeholder-slate-500"
                  placeholder="Brief description of the document..."
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Select File *
                </label>
                <div className="border-2 border-dashed border-slate-700/50 rounded-2xl p-6 text-center hover:border-blue-500/50 transition-colors bg-slate-800/30">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FaUpload className="text-4xl text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-300 text-sm">Click to select document</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX, TXT</p>
                  </label>
                </div>
                {selectedFile && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-300 bg-slate-800/50 p-2 rounded-xl">
                    <FaFileAlt className="text-blue-400" />
                    <span>{selectedFile.name}</span>
                    <span className="text-slate-500">({formatFileSize(selectedFile.size)})</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setDocName('');
                  setDocDescription('');
                  setSelectedFile(null);
                  setUploadProgress('');
                  setProcessingSteps([]);
                }}
                className="flex-1 py-2.5 border border-slate-700/50 text-slate-300 rounded-2xl hover:bg-slate-800/50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadDocument}
                disabled={!docName || !selectedFile}
                className="flex-1 py-2.5 bg-blue-500 text-slate-50 rounded-2xl hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/40 hover:shadow-blue-400/50 text-sm font-semibold"
              >
                Upload & Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal - Compact Progress View */}
      {uploading && !isMinimized && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-3xl border border-slate-800/60 bg-slate-900 shadow-[0_0_60px_rgba(15,23,42,0.8)] p-6 max-w-md w-full mx-4">
            {/* Header with minimize button */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50 truncate flex-1">{docName}</h3>
              <button
                onClick={() => setIsMinimized(true)}
                className="ml-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                title="Minimize"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-sm text-slate-400 flex-1">{uploadProgress}</span>
            </div>
            
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>Embedding Progress</span>
                <span className="font-semibold text-blue-400">{uploadPercent}%</span>
              </div>
              <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden ring-1 ring-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Upload Progress Card (bottom right) - Only when minimized */}
      {uploading && isMinimized && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
          {/* Minimized Card */}
          <div 
            className={`rounded-2xl bg-slate-900 shadow-[0_0_60px_rgba(15,23,42,0.8)] w-80 transition-all backdrop-blur-xl ring-2 ${
              uploadPercent === 100 ? 'ring-emerald-500/50 cursor-pointer' : 'ring-blue-500/50 cursor-pointer'
            }`}
            onClick={() => {
              if (uploadPercent === 100 && completedDocId) {
                // Navigate to document chat
                router.push(`/chat/documents/${completedDocId}`);
                // Reset states
                setUploading(false);
                setShowUploadModal(false);
                setDocName('');
                setDocDescription('');
                setSelectedFile(null);
                setUploadProgress('');
                setProcessingSteps([]);
                setCompletedDocId('');
                setIsMinimized(false);
              } else {
                setIsMinimized(false);
              }
            }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1">
                  {uploadPercent === 100 ? (
                    <span className="text-emerald-400 text-lg">✓</span>
                  ) : (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  )}
                  <span className="font-medium text-sm text-slate-50 truncate">{docName}</span>
                </div>
                {uploadPercent === 100 ? (
                  <span className="text-xs text-emerald-400 font-medium">Click to open</span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(false);
                    }}
                    className="text-slate-400 hover:text-slate-50 ml-2 transition-colors"
                    title="Expand"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-400 mb-2">{uploadProgress}</div>
              {/* Progress bar */}
              <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden ring-1 ring-slate-700/50">
                <div 
                  className={`h-full transition-all duration-500 ${
                    uploadPercent === 100 
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                      : 'bg-gradient-to-r from-blue-500 to-blue-400'
                  }`}
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}