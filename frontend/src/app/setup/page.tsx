"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Setup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [parsingPdf, setParsingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    company: "",
    job_description: "",
    resume: "",
    interview_type: "behavioral",
    persona: "neutral",
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFileName(file.name);
    setParsingPdf(true);
    setError("");

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/resume/parse", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (data.success && data.text) {
        setFormData((prev) => ({ ...prev, resume: data.text }));
      } else {
        setError("Could not extract text from this file. Try a different PDF.");
        setResumeFileName("");
      }
    } catch (err) {
      setError("Upload failed. Make sure backend is running.");
      setResumeFileName("");
    } finally {
      setParsingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.resume.trim()) {
      setError("Please upload your resume first.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8000/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to start interview");
      const data = await res.json();

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
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white py-12 px-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute top-0 -left-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Interview Setup
          </h1>
          <p className="text-slate-300 text-lg">
            Let&apos;s personalize your practice session ✨
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
        >
          {/* Company */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-200">
              🏢 Company
            </label>
            <input
              type="text"
              required
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
              placeholder="e.g., Google, Stripe, Anthropic"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-400 focus:bg-white/10 focus:outline-none transition-all placeholder:text-slate-500"
            />
          </div>

          {/* JD */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-200">
              📝 Job Description
            </label>
            <textarea
              required
              rows={5}
              value={formData.job_description}
              onChange={(e) =>
                setFormData({ ...formData, job_description: e.target.value })
              }
              placeholder="Paste the job description here..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-400 focus:bg-white/10 focus:outline-none resize-none transition-all placeholder:text-slate-500"
            />
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-200">
              📄 Your Resume (PDF)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingPdf}
              className={`w-full px-4 py-6 border-2 border-dashed rounded-xl transition-all ${
                resumeFileName
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-white/20 hover:border-purple-400 hover:bg-white/5"
              } ${parsingPdf ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
            >
              {parsingPdf ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span>Parsing your PDF...</span>
                </div>
              ) : resumeFileName ? (
                <div className="space-y-1">
                  <div className="text-green-400 text-2xl">✓</div>
                  <div className="font-semibold">{resumeFileName}</div>
                  <div className="text-xs text-slate-400">
                    {formData.resume.length} characters extracted • Click to change
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-3xl">📎</div>
                  <div className="font-semibold">Click to upload your resume</div>
                  <div className="text-xs text-slate-400">PDF or TXT, max 5MB</div>
                </div>
              )}
            </button>
          </div>

          {/* Selects */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-200">
                🎯 Interview Type
              </label>
              <select
                value={formData.interview_type}
                onChange={(e) =>
                  setFormData({ ...formData, interview_type: e.target.value })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-400 focus:outline-none transition-all"
              >
                <option value="screening">Screening</option>
                <option value="behavioral">Behavioral</option>
                <option value="technical_coding">Technical / Coding</option>
                <option value="system_design">System Design</option>
                <option value="hr">HR / Culture Fit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-200">
                🎭 Interviewer Style
              </label>
              <select
                value={formData.persona}
                onChange={(e) =>
                  setFormData({ ...formData, persona: e.target.value })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-400 focus:outline-none transition-all"
              >
                <option value="friendly">😊 Friendly</option>
                <option value="neutral">😐 Neutral</option>
                <option value="adversarial">😤 Stress Mode</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || parsingPdf}
            className="w-full py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02]"
          >
            {loading ? "Starting your interview..." : "Begin Interview 🚀"}
          </button>
        </form>
      </div>
    </main>
  );
}