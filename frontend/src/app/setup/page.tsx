"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/config";

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <polyline points="16 18 22 12 16 6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="8 6 2 12 8 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconNodes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <rect x="2" y="2" width="6" height="5" rx="1" />
      <rect x="16" y="2" width="6" height="5" rx="1" />
      <rect x="9" y="17" width="6" height="5" rx="1" />
      <path d="M5 7v3.5h14V7M12 10.5V17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const INTERVIEW_TYPES = [
  {
    value: "screening",
    label: "Screening",
    Icon: IconSearch,
    desc: "Initial filter",
    gradient: "from-sky-500 to-blue-600",
    shadow: "shadow-sky-500/40",
    ring: "ring-sky-400",
  },
  {
    value: "behavioral",
    label: "Behavioral",
    Icon: IconChat,
    desc: "STAR method",
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/40",
    ring: "ring-emerald-400",
  },
  {
    value: "technical_coding",
    label: "Technical",
    Icon: IconCode,
    desc: "Coding & DSA",
    gradient: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/40",
    ring: "ring-violet-400",
  },
  {
    value: "system_design",
    label: "System Design",
    Icon: IconNodes,
    desc: "Scale & arch",
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/40",
    ring: "ring-amber-400",
  },
  {
    value: "hr",
    label: "HR / Culture",
    Icon: IconHeart,
    desc: "Values & fit",
    gradient: "from-rose-500 to-pink-600",
    shadow: "shadow-rose-500/40",
    ring: "ring-rose-400",
  },
];

const PERSONAS = [
  {
    value: "friendly",
    label: "Friendly",
    emoji: "😊",
    desc: "Warm & supportive",
    activeBg: "from-emerald-500/25 to-teal-500/25",
    activeBorder: "border-emerald-400",
    activeShadow: "shadow-emerald-500/20",
  },
  {
    value: "neutral",
    label: "Neutral",
    emoji: "😐",
    desc: "Professional & fair",
    activeBg: "from-blue-500/25 to-sky-500/25",
    activeBorder: "border-blue-400",
    activeShadow: "shadow-blue-500/20",
  },
  {
    value: "adversarial",
    label: "Stress Mode",
    emoji: "😤",
    desc: "Tough & challenging",
    activeBg: "from-red-500/25 to-orange-500/25",
    activeBorder: "border-red-400",
    activeShadow: "shadow-red-500/20",
  },
];

export default function Setup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [parsingPdf, setParsingPdf] = useState(false);
  const [startElapsed, setStartElapsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      const res = await fetch(`${API_URL}/api/resume/parse`, {
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
    } catch {
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
    const t0 = Date.now();
    setStartElapsed(0);
    setLoading(true);
    setError("");
    startTimerRef.current = setInterval(() => {
      setStartElapsed(Math.round((Date.now() - t0) / 100) / 10);
    }, 100);
    try {
      const res = await fetch(`${API_URL}/api/interview/start`, {
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
      if (startTimerRef.current) {
        clearInterval(startTimerRef.current);
        startTimerRef.current = null;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-brand-gradient text-white py-12 px-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />

      <div className="max-w-3xl mx-auto relative z-10">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            AI Interview Coach
          </div>
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
            Set Up Your Interview
          </h1>
          <p className="text-emerald-100/60 text-lg">
            Personalize your AI-powered mock interview in 60 seconds
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Company + Resume row */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-xl">
              <label className="block text-xs font-bold mb-3 text-emerald-400 uppercase tracking-widest">
                🏢 Target Company
              </label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g., Google, Stripe…"
                className="w-full px-4 py-3 bg-emerald-950/50 border border-emerald-500/20 rounded-xl focus:border-emerald-400 focus:outline-none transition-all placeholder:text-emerald-100/25 text-white"
              />
            </div>

            <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-xl">
              <label className="block text-xs font-bold mb-3 text-emerald-400 uppercase tracking-widest">
                📄 Your Resume
              </label>
              <input ref={fileInputRef} type="file" accept=".pdf,.txt" onChange={handleFileUpload} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingPdf}
                className={`w-full py-3 px-4 border-2 border-dashed rounded-xl transition-all text-sm ${
                  resumeFileName
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-emerald-500/20 hover:border-emerald-400/60 hover:bg-emerald-900/20"
                } ${parsingPdf ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
              >
                {parsingPdf ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-emerald-300">Parsing…</span>
                  </div>
                ) : resumeFileName ? (
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-lg">✓</span>
                    <div className="text-left overflow-hidden">
                      <div className="font-semibold text-emerald-300 truncate">{resumeFileName}</div>
                      <div className="text-[11px] text-emerald-100/40">{formData.resume.length} chars • click to change</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-emerald-100/50">
                    <span className="text-xl">📎</span>
                    <span>Upload PDF or TXT</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Job Description */}
          <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-xl">
            <label className="block text-xs font-bold mb-3 text-emerald-400 uppercase tracking-widest">
              📝 Job Description
            </label>
            <textarea
              required
              rows={4}
              value={formData.job_description}
              onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
              placeholder="Paste the job description here…"
              className="w-full px-4 py-3 bg-emerald-950/50 border border-emerald-500/20 rounded-xl focus:border-emerald-400 focus:outline-none resize-none transition-all placeholder:text-emerald-100/25 text-white"
            />
          </div>

          {/* Interview Type — Netflix-style card picker */}
          <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-xl">
            <label className="block text-xs font-bold mb-4 text-emerald-400 uppercase tracking-widest">
              🎯 Interview Type
            </label>
            <div className="grid grid-cols-5 gap-3">
              {INTERVIEW_TYPES.map(({ value, label, Icon, desc, gradient, shadow, ring }) => {
                const selected = formData.interview_type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, interview_type: value })}
                    className={`relative flex flex-col items-center gap-2.5 py-5 px-2 rounded-2xl border-2 transition-all duration-200 ${
                      selected
                        ? `bg-gradient-to-br ${gradient} border-transparent shadow-xl ${shadow} scale-105`
                        : "bg-emerald-950/60 border-emerald-500/15 hover:border-emerald-400/40 hover:scale-[1.03] hover:bg-emerald-900/40"
                    }`}
                  >
                    {selected && (
                      <span className={`absolute inset-0 rounded-2xl ring-2 ${ring} ring-offset-1 ring-offset-transparent pointer-events-none`} />
                    )}
                    <span className={selected ? "text-white" : "text-emerald-300/60"}>
                      <Icon />
                    </span>
                    <span className={`text-xs font-bold text-center leading-tight ${selected ? "text-white" : "text-emerald-100/70"}`}>
                      {label}
                    </span>
                    <span className={`text-[10px] text-center leading-tight ${selected ? "text-white/75" : "text-emerald-100/35"}`}>
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Persona — card picker */}
          <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-xl">
            <label className="block text-xs font-bold mb-4 text-emerald-400 uppercase tracking-widest">
              🎭 Interviewer Style
            </label>
            <div className="grid grid-cols-3 gap-4">
              {PERSONAS.map(({ value, label, emoji, desc, activeBg, activeBorder, activeShadow }) => {
                const selected = formData.persona === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, persona: value })}
                    className={`flex flex-col items-center gap-3 py-5 px-4 rounded-2xl border-2 transition-all duration-200 ${
                      selected
                        ? `bg-gradient-to-br ${activeBg} ${activeBorder} shadow-lg ${activeShadow} scale-105`
                        : "bg-emerald-950/60 border-emerald-500/15 hover:border-emerald-400/40 hover:scale-[1.03]"
                    }`}
                  >
                    <span className="text-4xl">{emoji}</span>
                    <div className="text-center">
                      <div className={`font-bold text-sm ${selected ? "text-white" : "text-emerald-100/80"}`}>{label}</div>
                      <div className={`text-xs mt-0.5 ${selected ? "text-white/65" : "text-emerald-100/35"}`}>{desc}</div>
                    </div>
                  </button>
                );
              })}
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
            className="w-full py-5 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:via-teal-300 hover:to-emerald-400 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-xl transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/50 hover:scale-[1.02]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span>Starting your interview…</span>
                <span className="font-mono text-slate-900/60">{startElapsed.toFixed(1)}s</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Begin Interview
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
