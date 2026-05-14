"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
        setError("Could not extract text from this file.");
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
    <main className="min-h-screen bg-brand-gradient text-white py-12 px-4 relative overflow-hidden">
      {/* Animated background blobs in green */}
      <div className="absolute top-0 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />

      {/* Back link */}
      <Link
        href="/"
        className="relative z-10 inline-flex items-center gap-2 text-emerald-300/70 hover:text-emerald-300 transition-colors mb-6 max-w-2xl mx-auto block"
      >
        ← Back to home
      </Link>

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
            Interview Setup
          </h1>
          <p className="text-emerald-100/70 text-lg">
            Let&apos;s personalize your practice session ✨
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-emerald-950/40 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-8 shadow-2xl shadow-emerald-500/10"
        >
          {/* Company */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-emerald-100">
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
              className="w-full px-4 py-3 bg-emerald-950/60 border border-emerald-500/20 rounded-xl focus:border-emerald-400 focus:bg-emerald-900/40 focus:outline-none transition-all placeholder:text-emerald-100/30 text-white"
            />
          </div>

          {/* JD */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-emerald-100">
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
              className="w-full px-4 py-3 bg-emerald-950/60 border border-emerald-500/20 rounded-xl focus:border-emerald-400 focus:bg-emerald-900/40 focus:outline-none resize-none transition-all placeholder:text-emerald-100/30 text-white"
            />
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-emerald-100">
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
                  ? "border-emerald-400/60 bg-emerald-500/10"
                  : "border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/5"
              } ${parsingPdf ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
            >
              {parsingPdf ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span>Parsing your PDF...</span>
                </div>
              ) : resumeFileName ? (
                <div className="space-y-1">
                  <div className="text-emerald-400 text-2xl">✓</div>
                  <div className="font-semibold">{resumeFileName}</div>
                  <div className="text-xs text-emerald-100/50">
                    {formData.resume.length} characters extracted • Click to change
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-3xl">📎</div>
                  <div className="font-semibold">Click to upload your resume</div>
                  <div className="text-xs text-emerald-100/50">PDF or TXT, max 5MB</div>
                </div>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-emerald-100">
                🎯 Interview Type
              </label>
              <select
                value={formData.interview_type}
                onChange={(e) =>
                  setFormData({ ...formData, interview_type: e.target.value })
                }
                className="w-full px-4 py-3 bg-emerald-950/60 border border-emerald-500/20 rounded-xl focus:border-emerald-400 focus:outline-none transition-all text-white"
              >
                <option value="screening">Screening</option>
                <option value="behavioral">Behavioral</option>
                <option value="technical_coding">Technical / Coding</option>
                <option value="system_design">System Design</option>
                <option value="hr">HR / Culture Fit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-emerald-100">
                🎭 Interviewer Style
              </label>
              <select
                value={formData.persona}
                onChange={(e) =>
                  setFormData({ ...formData, persona: e.target.value })
                }
                className="w-full px-4 py-3 bg-emerald-950/60 border border-emerald-500/20 rounded-xl focus:border-emerald-400 focus:outline-none transition-all text-white"
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
            className="w-full py-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:via-teal-300 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg text-slate-900 transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/50 hover:scale-[1.02]"
          >
            {loading ? "Starting your interview..." : "Begin Interview 🚀"}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-emerald-100/40">
          © {new Date().getFullYear()} Built by Achyuth
        </div>
      </div>
    </main>
  );
}