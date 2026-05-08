"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<string>("Checking...");
  const [backendMessage, setBackendMessage] = useState<string>("");

  useEffect(() => {
    fetch("http://localhost:8000/api/hello")
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus("✅ Connected");
        setBackendMessage(data.message);
      })
      .catch((err) => {
        setBackendStatus("❌ Disconnected");
        setBackendMessage("Backend is not running");
        console.error(err);
      });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          AI Panel Interview Coach
        </h1>
        <p className="text-xl text-slate-300">
          Practice interviews with multiple AI agents
        </p>

        <div className="mt-8 p-6 bg-slate-800/50 border border-slate-700 rounded-lg max-w-md mx-auto">
          <h2 className="text-lg font-semibold mb-3">System Status</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Frontend:</span>
              <span>✅ Running</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Backend:</span>
              <span>{backendStatus}</span>
            </div>
            {backendMessage && (
              <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700">
                {backendMessage}
              </div>
            )}
          </div>
        </div>

        <div className="text-sm text-slate-400 mt-8">
          🚧 Phase 1: Foundation Setup
        </div>
      </div>
    </main>
  );
}