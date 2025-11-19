"use client";

import React, { useEffect, useState } from "react";

type HealthStatus = {
  status: string;
  timestamp: string;
  responseTime: string;
  checks: {
    environment: { status: string; errors?: string[] };
    pinecone: { status: string; vectorCount?: number };
    openai: { status: string };
  };
  version: string;
  environment: string;
};

export default function AdminDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/health");
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch health status");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok":
      case "healthy":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
      case "healthy":
        return "✅";
      case "degraded":
        return "⚠️";
      case "error":
        return "❌";
      default:
        return "❓";
    }
  };

  if (loading && !health) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchHealth}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">System Dashboard</h1>
            <button 
              onClick={fetchHealth}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>

          {health && (
            <>
              {/* Overall Status */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">System Status</h2>
                    <p className={`text-2xl font-bold ${getStatusColor(health.status)}`}>
                      {getStatusIcon(health.status)} {health.status.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <p>Version: {health.version}</p>
                    <p>Environment: {health.environment}</p>
                    <p>Response Time: {health.responseTime}</p>
                    <p>Last Check: {new Date(health.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Services Grid */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Environment Check */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-3">Environment</h3>
                  <p className={`text-xl font-bold ${getStatusColor(health.checks.environment.status)}`}>
                    {getStatusIcon(health.checks.environment.status)} {health.checks.environment.status.toUpperCase()}
                  </p>
                  {health.checks.environment.errors && health.checks.environment.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-600 mb-1">Issues:</p>
                      <ul className="text-sm text-red-600 space-y-1">
                        {health.checks.environment.errors.map((err, idx) => (
                          <li key={idx} className="break-words">• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Pinecone Check */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-3">Pinecone DB</h3>
                  <p className={`text-xl font-bold ${getStatusColor(health.checks.pinecone.status)}`}>
                    {getStatusIcon(health.checks.pinecone.status)} {health.checks.pinecone.status.toUpperCase()}
                  </p>
                  {health.checks.pinecone.vectorCount !== undefined && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600">
                        Vectors: <span className="font-semibold">{health.checks.pinecone.vectorCount.toLocaleString()}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* OpenAI Check */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-3">OpenAI API</h3>
                  <p className={`text-xl font-bold ${getStatusColor(health.checks.openai.status)}`}>
                    {getStatusIcon(health.checks.openai.status)} {health.checks.openai.status.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 p-6 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="/"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Go to Chat
                  </a>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Reload Page
                  </button>
                </div>
              </div>

              {/* Instructions */}
              {health.status !== "healthy" && (
                <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-yellow-800">Setup Instructions</h3>
                  <ol className="text-sm text-yellow-700 space-y-2">
                    <li>1. Create a <code className="bg-yellow-100 px-1 rounded">.env</code> file from <code className="bg-yellow-100 px-1 rounded">.env.example</code></li>
                    <li>2. Add your OpenAI API key and Pinecone credentials</li>
                    <li>3. Run <code className="bg-yellow-100 px-1 rounded">npm run check-env</code> to verify configuration</li>
                    <li>4. Run <code className="bg-yellow-100 px-1 rounded">npm run index-docs</code> to populate the vector database</li>
                    <li>5. Restart the development server</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}