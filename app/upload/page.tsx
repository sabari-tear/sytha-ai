"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [vectorCount, setVectorCount] = useState(0);
  const [progress, setProgress] = useState("");
  const [indexingSteps, setIndexingSteps] = useState<Array<{step: string, status: 'pending' | 'processing' | 'completed' | 'error', detail?: string}>>([]);
  const [currentStep, setCurrentStep] = useState("");

  useEffect(() => {
    checkPineconeStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkPineconeStatus = async () => {
    try {
      const response = await fetch("/api/pinecone/status");
      const data = await response.json();
      
      setVectorCount(data.vectorCount || 0);
      setChecking(false);
    } catch (err) {
      console.error("Failed to check Pinecone status:", err);
      setChecking(false);
    }
  };

  const handleIndexDocuments = async () => {
    setIsUploading(true);
    setError(null);
    setStatus(null);
    setCurrentStep("Initializing...");
    
    // Initialize progress steps
    const steps = [
      { step: "Validating environment", status: 'pending' as const, detail: "" },
      { step: "Loading documents from dataset folder", status: 'pending' as const, detail: "" },
      { step: "Chunking documents", status: 'pending' as const, detail: "" },
      { step: "Generating embeddings and indexing", status: 'pending' as const, detail: "" },
      { step: "Verifying index integrity", status: 'pending' as const, detail: "" }
    ];
    setIndexingSteps(steps);

    // Update step status helper
    const updateStep = (index: number, status: 'processing' | 'completed' | 'error', detail?: string) => {
      setIndexingSteps(prev => {
        const newSteps = [...prev];
        newSteps[index] = { ...newSteps[index], status, detail };
        return newSteps;
      });
    };

    try {
      const response = await fetch("/api/pinecone/index", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clearExisting: false }),
      });

      if (!response.ok) {
        throw new Error("Failed to start indexing");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response reader available");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.step === 'validate') {
              if (data.status === 'processing') updateStep(0, 'processing');
              if (data.status === 'completed') updateStep(0, 'completed', '✓ Environment validated');
              if (data.status === 'error') throw new Error(data.message);
              setCurrentStep(data.message);
            } else if (data.step === 'load') {
              if (data.status === 'processing') updateStep(1, 'processing');
              if (data.status === 'completed') updateStep(1, 'completed', `✓ ${data.message}`);
              if (data.status === 'error') throw new Error(data.message);
              setCurrentStep(data.message);
            } else if (data.step === 'chunk') {
              if (data.status === 'processing') updateStep(2, 'processing');
              if (data.status === 'completed') updateStep(2, 'completed', `✓ ${data.message}`);
              setCurrentStep(data.message);
            } else if (data.step === 'index') {
              if (data.status === 'processing') {
                updateStep(3, 'processing', data.percent ? `${data.percent}% complete` : '');
                setCurrentStep(data.message);
              }
              if (data.status === 'completed') updateStep(3, 'completed', `✓ ${data.message}`);
            } else if (data.step === 'verify') {
              if (data.status === 'processing') updateStep(4, 'processing');
              if (data.status === 'completed') {
                updateStep(4, 'completed', `✓ Verified ${data.vectorCount} vectors`);
                setStatus(`Successfully indexed ${data.totalIndexed} chunks from ${data.totalDocuments} documents!`);
              }
              setCurrentStep(data.message);
            } else if (data.step === 'complete') {
              setCurrentStep("");
              setProgress("");
              await checkPineconeStatus();
              setTimeout(() => router.push("/"), 2000);
            } else if (data.step === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }
    } catch (err) {
      setIndexingSteps(prev => prev.map(step => 
        step.status === 'processing' ? { ...step, status: 'error' as const, detail: '✗ Failed' } : step
      ));
      setError(err instanceof Error ? err.message : "Failed to index documents");
      setProgress("");
      setCurrentStep("");
    } finally {
      setIsUploading(false);
      if (!error) {
        setTimeout(() => setIndexingSteps([]), 3000);
      }
    }
  };

  const handleClearAndIndex = async () => {
    if (!confirm("This will re-index all documents from the dataset folder, replacing existing vectors. Are you sure?")) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setStatus(null);
    setCurrentStep("Preparing to re-index...");
    
    // Initialize progress steps for re-indexing
    const steps = [
      { step: "Preparing index for re-indexing", status: 'pending' as const, detail: "" },
      { step: "Validating environment", status: 'pending' as const, detail: "" },
      { step: "Loading documents from dataset folder", status: 'pending' as const, detail: "" },
      { step: "Chunking documents", status: 'pending' as const, detail: "" },
      { step: "Generating embeddings and indexing", status: 'pending' as const, detail: "" },
      { step: "Verifying index integrity", status: 'pending' as const, detail: "" }
    ];
    setIndexingSteps(steps);
    
    const updateStep = (index: number, status: 'processing' | 'completed' | 'error', detail?: string) => {
      setIndexingSteps(prev => {
        const newSteps = [...prev];
        newSteps[index] = { ...newSteps[index], status, detail };
        return newSteps;
      });
    };
    
    setProgress("Clearing existing vectors and re-indexing...");

    try {
      const response = await fetch("/api/pinecone/index", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clearExisting: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to start re-indexing");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response reader available");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.step === 'clear') {
              if (data.status === 'processing') updateStep(0, 'processing');
              if (data.status === 'completed') updateStep(0, 'completed', '✓ Ready to re-index');
              setCurrentStep(data.message);
            } else if (data.step === 'validate') {
              if (data.status === 'processing') updateStep(1, 'processing');
              if (data.status === 'completed') updateStep(1, 'completed', '✓ Environment validated');
              if (data.status === 'error') throw new Error(data.message);
              setCurrentStep(data.message);
            } else if (data.step === 'load') {
              if (data.status === 'processing') updateStep(2, 'processing');
              if (data.status === 'completed') updateStep(2, 'completed', `✓ ${data.message}`);
              if (data.status === 'error') throw new Error(data.message);
              setCurrentStep(data.message);
            } else if (data.step === 'chunk') {
              if (data.status === 'processing') updateStep(3, 'processing');
              if (data.status === 'completed') updateStep(3, 'completed', `✓ ${data.message}`);
              setCurrentStep(data.message);
            } else if (data.step === 'index') {
              if (data.status === 'processing') {
                updateStep(4, 'processing', data.percent ? `${data.percent}% complete` : '');
                setCurrentStep(data.message);
              }
              if (data.status === 'completed') updateStep(4, 'completed', `✓ ${data.message}`);
            } else if (data.step === 'verify') {
              if (data.status === 'processing') updateStep(5, 'processing');
              if (data.status === 'completed') {
                updateStep(5, 'completed', `✓ Verified ${data.vectorCount} vectors`);
                setStatus(`Successfully re-indexed ${data.totalIndexed} chunks from ${data.totalDocuments} documents!`);
              }
              setCurrentStep(data.message);
            } else if (data.step === 'complete') {
              setCurrentStep("");
              setProgress("");
              await checkPineconeStatus();
              setTimeout(() => router.push("/"), 2000);
            } else if (data.step === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }
    } catch (err) {
      setIndexingSteps(prev => prev.map(step => 
        step.status === 'processing' ? { ...step, status: 'error' as const, detail: '✗ Failed' } : step
      ));
      setError(err instanceof Error ? err.message : "Failed to clear and index");
      setProgress("");
      setCurrentStep("");
    } finally {
      setIsUploading(false);
      if (!error) {
        setTimeout(() => setIndexingSteps([]), 3000);
      }
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setIndexingSteps([]);

    if (!files || files.length === 0) {
      setError("Please select at least one file to upload.");
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    setIsUploading(true);
    
    // Set up progress for manual upload
    const uploadSteps = [
      { step: `Reading ${files.length} file(s)`, status: 'processing' as const, detail: "" },
      { step: "Processing text content", status: 'pending' as const, detail: "" },
      { step: "Generating embeddings", status: 'pending' as const, detail: "" },
      { step: "Uploading to Pinecone", status: 'pending' as const, detail: "" }
    ];
    setIndexingSteps(uploadSteps);
    setCurrentStep(`Uploading ${files.length} file(s)...`);

    try {
      // Update step 1
      await new Promise(resolve => setTimeout(resolve, 500));
      setIndexingSteps(prev => {
        const newSteps = [...prev];
        newSteps[0] = { ...newSteps[0], status: 'completed', detail: `✓ Read ${files.length} file(s)` };
        newSteps[1] = { ...newSteps[1], status: 'processing' };
        return newSteps;
      });
      setCurrentStep("Processing text content...");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      // Update step 2
      setIndexingSteps(prev => {
        const newSteps = [...prev];
        newSteps[1] = { ...newSteps[1], status: 'completed', detail: "✓ Processed" };
        newSteps[2] = { ...newSteps[2], status: 'processing' };
        return newSteps;
      });
      setCurrentStep("Generating embeddings...");
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update step 3
      setIndexingSteps(prev => {
        const newSteps = [...prev];
        newSteps[2] = { ...newSteps[2], status: 'completed', detail: "✓ Generated" };
        newSteps[3] = { ...newSteps[3], status: 'processing' };
        return newSteps;
      });
      setCurrentStep("Uploading to Pinecone...");

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fileCount?: number;
        uploadedChunks?: number;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      // Update step 4
      setIndexingSteps(prev => {
        const newSteps = [...prev];
        newSteps[3] = { ...newSteps[3], status: 'completed', detail: `✓ Uploaded ${data.uploadedChunks} chunks` };
        return newSteps;
      });

      setStatus(
        `Successfully uploaded ${data.uploadedChunks ?? 0} chunks from ${data.fileCount ?? files.length} file(s) into Pinecone index.`,
      );
      setCurrentStep("");
    } catch (err: unknown) {
      console.error(err);
      // Mark current processing step as error
      setIndexingSteps(prev => prev.map(step => 
        step.status === 'processing' ? { ...step, status: 'error' as const, detail: '✗ Failed' } : step
      ));
      const message = err instanceof Error ? err.message : "Unexpected error during upload.";
      setError(message);
      setCurrentStep("");
    } finally {
      setIsUploading(false);
      // Clear steps after success
      if (!error) {
        setTimeout(() => {
          setIndexingSteps([]);
          setFiles(null);
        }, 3000);
      }
    }
  }

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

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <main className="mx-auto max-w-6xl">
        <header className="mt-4 space-y-3 text-center sm:mt-8 sm:space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-200 shadow-sm shadow-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Database Management
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl lg:text-5xl">
            Legal Database Setup
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-sm text-slate-300 sm:text-base">
            Initialize the vector database with Indian legal documents
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <section className="flex flex-col rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl">
            <header className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3 sm:px-6">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-slate-300">
                  Database Management
                </h2>
                <p className="text-xs text-slate-400">
                  Configure and populate the legal document vector database
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {vectorCount > 0 ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-emerald-400">Active</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-amber-400">Empty</span>
                  </>
                )}
              </div>
            </header>

            <div className="flex-1 space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              {/* Status Card */}
              <div className={`rounded-2xl p-6 ring-1 ${
                vectorCount > 0 
                  ? 'bg-emerald-900/20 ring-emerald-700/50' 
                  : 'bg-amber-900/20 ring-amber-700/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100 mb-2">
                      {vectorCount > 0 ? '✅ Database Status: Populated' : '⚠️ Database Status: Empty'}
                    </h3>
                    <p className="text-sm text-slate-300">
                      {vectorCount > 0 
                        ? `The database contains ${vectorCount.toLocaleString()} indexed vectors.`
                        : 'No legal documents are currently indexed in the database.'}
                    </p>
                  </div>
                  {vectorCount > 0 && (
                    <button
                      onClick={() => router.push("/")}
                      className="rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-slate-50 shadow-lg shadow-brand-500/40 transition hover:bg-brand-400 hover:shadow-brand-400/50"
                    >
                      Go to Chat →
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {vectorCount === 0 ? (
                  <button
                    onClick={handleIndexDocuments}
                    disabled={isUploading}
                    className={`w-full rounded-2xl py-3 px-6 text-sm font-semibold transition-all ${
                      isUploading 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-500 text-slate-50 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 hover:shadow-emerald-400/50'
                    }`}
                  >
                    {isUploading ? 'Indexing in progress...' : '🚀 Index Legal Documents from Dataset'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => router.push("/")}
                      className="w-full rounded-2xl bg-brand-500 py-3 px-6 text-sm font-semibold text-slate-50 shadow-lg shadow-brand-500/40 transition hover:bg-brand-400 hover:shadow-brand-400/50"
                    >
                      💬 Go to Legal Chat
                    </button>
                    <button
                      onClick={handleClearAndIndex}
                      disabled={isUploading}
                      className={`w-full rounded-2xl py-3 px-6 text-sm font-semibold transition-all ${
                        isUploading 
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                          : 'bg-slate-800/80 text-amber-400 ring-1 ring-amber-500/50 hover:bg-amber-900/30'
                      }`}
                    >
                      {isUploading ? 'Re-indexing in progress...' : '🔄 Re-index Database from Dataset'}
                    </button>
                  </>
                )}
              </div>

              {/* Progress/Status Display */}
              {indexingSteps.length > 0 && isUploading && (
                <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-200 mb-4">📊 Indexing Progress</h3>
                  <div className="space-y-3">
                    {indexingSteps.map((step, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {step.status === 'completed' && (
                            <span className="text-emerald-400">✅</span>
                          )}
                          {step.status === 'processing' && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                          )}
                          {step.status === 'pending' && (
                            <span className="text-slate-500">⏳</span>
                          )}
                          {step.status === 'error' && (
                            <span className="text-rose-400">❌</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${
                            step.status === 'completed' ? 'text-emerald-300' :
                            step.status === 'processing' ? 'text-blue-300' :
                            step.status === 'error' ? 'text-rose-300' :
                            'text-slate-400'
                          }`}>
                            {step.step}
                          </p>
                          {step.detail && (
                            <p className="text-xs text-slate-500 mt-0.5">{step.detail}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {currentStep && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-xs text-slate-400 animate-pulse">{currentStep}</p>
                    </div>
                  )}
                </div>
              )}
              
              {progress && !indexingSteps.length && (
                <div className="rounded-2xl bg-slate-800/50 p-4 ring-1 ring-slate-700/50">
                  <div className="flex items-center gap-3">
                    {isUploading && (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-400"></div>
                    )}
                    <p className="text-sm text-slate-300">{progress}</p>
                  </div>
                </div>
              )}

              {status && (
                <div className="rounded-2xl bg-emerald-900/30 ring-1 ring-emerald-700/50 px-4 py-3">
                  <p className="text-sm text-emerald-300">✅ {status}</p>
                </div>
              )}

              {error && (
                <div className="rounded-2xl bg-rose-900/30 ring-1 ring-rose-700/50 px-4 py-3">
                  <p className="text-sm text-rose-300">❌ {error}</p>
                </div>
              )}

              {/* Manual Upload Section */}
              <div className="rounded-2xl bg-slate-800/30 p-5 ring-1 ring-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-200 mb-4">📁 Manual File Upload</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Upload Custom Documents
                    </label>
                    <p className="text-xs text-slate-500 mb-3">
                      Select text files (.txt, .md, .csv, .json) to add to the database
                    </p>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setFiles(e.target.files)}
                      className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-50 hover:file:bg-brand-400"
                      accept=".txt,.md,.csv,.json"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                      isUploading 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : 'bg-brand-500 text-slate-50 shadow-md shadow-brand-500/30 hover:bg-brand-400'
                    }`}
                  >
                    {isUploading ? "Uploading..." : "Upload Files to Pinecone"}
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="hidden flex-col gap-3 rounded-3xl border border-slate-800/60 bg-slate-950/50 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl lg:flex">
            <h3 className="text-sm font-semibold text-slate-200">📝 Available Data Sources</h3>
            
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-900/70 p-3 ring-1 ring-slate-700/70">
                <h4 className="text-xs font-semibold text-slate-200 mb-2">Legal Section CSVs:</h4>
                <ul className="space-y-1 text-xs text-slate-400">
                  <li>• IPC (Indian Penal Code)</li>
                  <li>• BNS (Bharatiya Nyaya Sanhita)</li>
                  <li>• BSA (Bharatiya Sakshya Adhiniyam)</li>
                  <li>• CrPC (Criminal Procedure Code)</li>
                </ul>
              </div>
              
              <div className="rounded-2xl bg-slate-900/70 p-3 ring-1 ring-slate-700/70">
                <h4 className="text-xs font-semibold text-slate-200 mb-2">Statute JSONs:</h4>
                <ul className="space-y-1 text-xs text-slate-400">
                  <li>• 800+ statute documents</li>
                  <li>• Case law references</li>
                  <li>• Legal provisions</li>
                  <li>• Amendments & updates</li>
                </ul>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-slate-900/70 p-3 text-[11px] leading-relaxed text-slate-400 ring-1 ring-slate-700/70">
              <p className="font-semibold text-slate-200">Instructions</p>
              <p className="mt-1">
                Click &quot;Index Legal Documents&quot; to populate the database with the complete legal dataset. 
                This process will embed and index all documents for semantic search.
              </p>
            </div>
          </aside>
        </div>

        <footer className="mt-6 border-t border-slate-800/70 pt-4 text-center text-[11px] text-slate-500">
          Database management interface for SythaAI Legal Chatbot. Ensure documents are properly indexed before using the chat feature.
        </footer>
      </main>
    </div>
  );
}
