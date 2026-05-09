"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<string>("Checking...");

  useEffect(() => {
    fetch("http://localhost:8000/api/check-keys")
      .then((res) => res.json())
      .then((data) => {
        if (data.gemini_configured) {
          setBackendStatus("✅ AI Ready");
        } else {
          setBackendStatus("⚠️ Missing API Key");
        }
      })
      .catch(() => setBackendStatus("❌ Backend Offline"));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white px-4">
      <div className="text-center space-y-8 max-w-2xl">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          AI Panel Interview Coach
        </h1>
        <p className="text-xl text-slate-300">
          Practice interviews with AI agents. Get instant feedback. Land your dream job.
        </p>

        <Link
          href="/setup"
          className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-semibold text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105"
        >
          Start Practicing →
        </Link>

        <div className="text-sm text-slate-500 pt-4">
          System Status: {backendStatus}
        </div>
      </div>
    </main>
  );
}