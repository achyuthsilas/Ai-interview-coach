"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Setup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    company: "",
    job_description: "",
    resume: "",
    interview_type: "behavioral",
    persona: "neutral",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8000/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to start interview");
      }

      const data = await res.json();

      // Save session info to localStorage so the interview page can read it
      localStorage.setItem(
        "interviewSession",
        JSON.stringify({
          sessionId: data.session_id,
          firstMessage: data.interviewer_message,
          company: formData.company,
        })
      );

      router.push("/interview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Interview Setup</h1>
        <p className="text-slate-400 mb-8">
          Tell us about the role you're preparing for.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Company</label>
            <input
              type="text"
              required
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
              placeholder="e.g., Google"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Job Description
            </label>
            <textarea
              required
              rows={6}
              value={formData.job_description}
              onChange={(e) =>
                setFormData({ ...formData, job_description: e.target.value })
              }
              placeholder="Paste the job description here..."
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Your Resume / Background
            </label>
            <textarea
              required
              rows={6}
              value={formData.resume}
              onChange={(e) =>
                setFormData({ ...formData, resume: e.target.value })
              }
              placeholder="Paste your resume or describe your background..."
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Interview Type
              </label>
              <select
                value={formData.interview_type}
                onChange={(e) =>
                  setFormData({ ...formData, interview_type: e.target.value })
                }
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="screening">Screening</option>
                <option value="behavioral">Behavioral</option>
                <option value="technical_coding">Technical / Coding</option>
                <option value="system_design">System Design</option>
                <option value="hr">HR / Culture Fit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Interviewer Style
              </label>
              <select
                value={formData.persona}
                onChange={(e) =>
                  setFormData({ ...formData, persona: e.target.value })
                }
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="friendly">Friendly</option>
                <option value="neutral">Neutral</option>
                <option value="adversarial">Adversarial (Stress Mode)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-all"
          >
            {loading ? "Setting up your interview..." : "Start Interview →"}
          </button>
        </form>
      </div>
    </main>
  );
}