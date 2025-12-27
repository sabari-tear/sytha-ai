'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FaFolder, FaPlus, FaTrash, FaBook, FaClock, FaFileAlt, FaUpload, FaSpinner, FaCheckCircle, FaMinus, FaExpand, FaTimes } from 'react-icons/fa';

interface Case {
  id: string;
  name: string;
  description: string;
  documents: string[];
  createdAt: Date;
  userId: string;
}

export default function CasesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [completedCaseId, setCompletedCaseId] = useState('');
  
  // Debug session
  useEffect(() => {
    console.log('[Cases Page] Session status:', status);
    console.log('[Cases Page] Session data:', JSON.stringify(session, null, 2));
  }, [session, status]);
  
  // Form state
  const [caseName, setCaseName] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      fetchCases();
    }
  }, [status]); // Only depend on status, not session object

  const fetchCases = async () => {
    if (!session?.user?.email) {
      console.log('[Fetch] No user email available, skipping fetch');
      setLoading(false);
      return;
    }
    
    const userId = session.user.email;  // Always use email as userId
    console.log('[Fetch] Fetching cases for userId:', userId);
    
    try {
      const url = `/api/cases?userId=${encodeURIComponent(userId)}`;
      console.log('[Fetch] Requesting:', url);
      const response = await fetch(url);
      console.log('[Fetch] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Fetch] Cases received:', data.length, 'cases');
        setCases(data);
      } else {
        const error = await response.text();
        console.error('[Fetch] Error response:', error);
      }
    } catch (error) {
      console.error('[Fetch] Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleCreateCase = async () => {
    console.log('[Create Case] Starting...', { 
      caseName, 
      filesCount: selectedFiles.length,
      sessionStatus: status,
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email
    });
    
    if (!caseName || selectedFiles.length === 0) {
      alert('Please provide a case name and select at least one document');
      return;
    }
    
    const userId = session?.user?.email || 'anonymous';
    console.log('[Create Case] Using userId:', userId);
    
    setUploading(true);
    setShowAddModal(false);
    setUploadProgress('Starting upload...');
    setUploadPercent(0);
    setProcessingSteps([]);
    setIsMinimized(false);
    setCompletedCaseId('');
    
    try {
      const formData = new FormData();
      formData.append('caseName', caseName);
      formData.append('caseDescription', caseDescription);
      formData.append('userId', userId);
      formData.append('streaming', 'true');
      
      selectedFiles.forEach((file) => {
        formData.append('documents', file);
      });

      const response = await fetch('/api/cases/create', {
        method: 'POST',
        body: formData
      });

      if (!response.ok || !response.body) {
        throw new Error('Upload failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let caseId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\\n\\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                if (data.embeddingProgress) {
                  setUploadProgress(data.step);
                  setUploadPercent(data.percent);
                } else {
                  setUploadProgress(data.step);
                  setUploadPercent(0);
                }
              } else if (data.type === 'complete') {
                caseId = data.caseId;
                setCompletedCaseId(caseId);
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

      // Case upload complete - no auto-redirect
      // Refetch cases to show the new one
      await fetchCases();
      
    } catch (error) {
      console.error('[Upload] Error:', error);
      alert(`Failed to create case: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUploading(false);
      setShowAddModal(true);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm('Are you sure you want to delete this case?')) return;
    
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setCases(cases.filter(c => c.id !== caseId));
      }
    } catch (error) {
      console.error('Error deleting case:', error);
    }
  };

  // Show loading while session is being fetched
  if (status === 'loading') {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-slate-300">Loading...</p>
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
            <h2 className="text-lg font-semibold text-slate-50">Case Analysis</h2>
            <p className="text-xs text-slate-400">Manage and analyze your legal cases with AI assistance</p>
          </div>
        </div>
        <div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-slate-50 rounded-xl hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/40 hover:shadow-brand-400/50 text-sm font-semibold"
          >
            <FaPlus />
            Add New Case
          </button>
        </div>
      </div>

      {/* Cases Grid */}
      <div className="flex-1 overflow-y-auto chat-scroll p-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-slate-400">Loading cases...</div>
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl p-12 text-center">
          <FaFolder className="text-6xl text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-50 mb-2">No Cases Yet</h3>
          <p className="text-sm text-slate-400 mb-6">Create your first case to start analyzing legal documents</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 text-slate-50 rounded-2xl hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/40 hover:shadow-brand-400/50 text-sm font-semibold"
          >
            <FaPlus />
            Create Your First Case
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((caseItem) => (
            <div
              key={caseItem.id}
              className="rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl hover:border-slate-700/80 transition-all duration-300 overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-500 rounded-2xl text-slate-50 shadow-lg shadow-brand-500/40">
                      <FaBook className="text-xl" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-slate-50">{caseItem.name}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <FaClock className="text-xs" />
                        {new Date(caseItem.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCase(caseItem.id)}
                    className="text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FaTrash />
                  </button>
                </div>
                
                <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                  {caseItem.description || 'No description provided'}
                </p>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <FaFileAlt />
                    <span>{caseItem.documents.length} document{caseItem.documents.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => router.push(`/chat/cases/${caseItem.id}`)}
                  className="w-full py-2.5 bg-brand-500 text-slate-50 rounded-2xl hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/40 hover:shadow-brand-400/50 text-sm font-semibold"
                >
                  Open Case Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Case Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-3xl border border-slate-800/60 bg-slate-900 shadow-[0_0_60px_rgba(15,23,42,0.8)] p-8 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-semibold mb-6 text-slate-50">Create New Case</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Case Name *
                </label>
                <input
                  type="text"
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 text-slate-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm placeholder-slate-500"
                  placeholder="e.g., Property Dispute Case"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Description
                </label>
                <textarea
                  value={caseDescription}
                  onChange={(e) => setCaseDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 text-slate-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 h-24 text-sm placeholder-slate-500"
                  placeholder="Brief description of the case..."
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Upload Documents *
                </label>
                <div className="border-2 border-dashed border-slate-700/50 rounded-2xl p-6 text-center hover:border-brand-500/50 transition-colors bg-slate-800/30">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FaUpload className="text-4xl text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-300 text-sm">Click to upload documents</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX, TXT (Multiple files allowed)</p>
                  </label>
                </div>
                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                        <FaFileAlt className="text-brand-400" />
                        <span>{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setCaseName('');
                  setCaseDescription('');
                  setSelectedFiles([]);
                }}
                className="flex-1 py-2.5 border border-slate-700/50 text-slate-300 rounded-2xl hover:bg-slate-800/50 text-sm font-medium"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                disabled={!caseName || selectedFiles.length === 0 || uploading}
                className="flex-1 py-2.5 bg-brand-500 text-slate-50 rounded-2xl hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/40 hover:shadow-brand-400/50 text-sm font-semibold"
              >
                {uploading ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Progress Modal (Center) */}
      {uploading && !isMinimized && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-3xl border border-slate-800/60 bg-slate-900 shadow-[0_0_60px_rgba(15,23,42,0.8)] p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-50">{caseName}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Minimize"
                >
                  <FaMinus className="text-slate-400" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="text-sm text-slate-400 mb-2">{uploadProgress}</div>
              
              <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden ring-1 ring-slate-700/50">
                <div 
                  className="bg-gradient-to-r from-brand-500 to-brand-400 h-full transition-all duration-300 flex items-center justify-end"
                  style={{ width: `${uploadPercent}%` }}
                >
                  {uploadPercent > 10 && (
                    <span className="text-xs text-slate-50 font-medium pr-2">{uploadPercent}%</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minimized Progress Card (Bottom Right) */}
      {uploading && isMinimized && (
        <div 
          className={`fixed bottom-6 right-6 rounded-2xl bg-slate-900 shadow-[0_0_60px_rgba(15,23,42,0.8)] p-4 w-80 z-50 ring-2 ${
            uploadPercent === 100 ? 'ring-emerald-500/50' : 'ring-brand-500/50'
          } cursor-pointer hover:shadow-[0_0_80px_rgba(15,23,42,0.9)] transition-all backdrop-blur-xl`}
          onClick={() => {
            if (uploadPercent === 100 && completedCaseId) {
              router.push(`/chat/cases/${completedCaseId}`);
              setUploading(false);
              setShowAddModal(false);
              setCaseName('');
              setCaseDescription('');
              setSelectedFiles([]);
              setUploadProgress('');
              setProcessingSteps([]);
              setCompletedCaseId('');
            } else {
              setIsMinimized(false);
            }
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {uploadPercent === 100 ? (
                <FaCheckCircle className="text-emerald-400 text-xl" />
              ) : (
                <FaSpinner className="animate-spin text-brand-400" />
              )}
              <span className="font-medium text-sm truncate text-slate-50">{caseName}</span>
            </div>
            <div className="flex gap-2">
              {uploadPercent === 100 ? (
                <span className="text-xs text-emerald-400 font-medium">Click to open</span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(false);
                  }}
                  className="p-1 hover:bg-slate-800 rounded"
                >
                  <FaExpand className="text-slate-400 text-xs" />
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden ring-1 ring-slate-700/50">
            <div 
              className={`h-full transition-all duration-300 ${
                uploadPercent === 100 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                  : 'bg-gradient-to-r from-brand-500 to-brand-400'
              }`}
              style={{ width: `${uploadPercent}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-1 truncate">{uploadProgress}</div>
        </div>
      )}
      </div>
    </div>
  );
}