"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/config";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<"checking" | "ready" | "offline">(
    "checking"
  );

  useEffect(() => {
    fetch(`${API_URL}/api/check-keys`)
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus(data.gemini_configured ? "ready" : "offline");
      })
      .catch(() => setBackendStatus("offline"));
  }, []);

  const scrollToGuide = () => {
    document.getElementById("guide")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-brand-gradient text-white overflow-x-hidden">
      {/* ====================================================
          HERO SECTION
      ==================================================== */}
      <section className="relative w-full min-h-screen flex flex-col">
        {/* Top nav */}
        <nav className="relative z-20 px-6 md:px-12 py-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center font-bold">
              AI
            </div>
            <span className="font-bold text-lg">Interview Coach</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                backendStatus === "ready"
                  ? "bg-emerald-400 animate-pulse"
                  : backendStatus === "offline"
                  ? "bg-red-400"
                  : "bg-yellow-400"
              }`}
            />
            <span className="text-slate-300">
              {backendStatus === "ready"
                ? "System Online"
                : backendStatus === "offline"
                ? "Backend Offline"
                : "Connecting..."}
            </span>
          </div>
        </nav>

        {/* Hero image with overlay */}
        <div className="relative flex-1 flex items-center justify-center">
          <div className="relative w-full max-w-7xl mx-auto px-4 md:px-8 scale-110">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/hero.png"
                alt="Master Your Interviews with Your AI Coach"
                className="w-full h-auto block"
              />

              {/* CTA button overlay — between headline and badges, left-aligned */}
              <div className="absolute top-[40%] left-[10%] flex flex-col items-start gap-3">
                <Link
                  href="/setup"
                  className="group relative px-10 py-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:via-teal-300 hover:to-emerald-400 rounded-full font-bold text-lg text-slate-900 shadow-2xl shadow-emerald-500/50 hover:shadow-emerald-400/70 transition-all hover:scale-105 animate-glow"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start Practicing
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll-down indicator */}
        <button
          onClick={scrollToGuide}
          className="relative z-10 mx-auto mb-8 mt-4 flex flex-col items-center gap-2 text-emerald-300/70 hover:text-emerald-300 transition-colors group"
        >
          <span className="text-xs uppercase tracking-widest">How it works</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 animate-bounce"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      {/* ====================================================
          GUIDE / HOW IT WORKS
      ==================================================== */}
      <section id="guide" className="relative py-20 px-4 md:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/30 to-transparent" />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r from-emerald-300 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              How It Works
            </h2>
            <p className="text-lg text-emerald-100/70 max-w-2xl mx-auto">
              Four AI agents work together to give you the most realistic interview
              practice you&apos;ve ever had — and detailed feedback after.
            </p>
          </div>

          {/* Step cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            <StepCard
              num="01"
              icon="📝"
              title="Set Up Your Interview"
              text="Upload your resume PDF, paste the job description, pick the role and interview style. We personalize every question."
            />
            <StepCard
              num="02"
              icon="🎙️"
              title="Talk to Your AI Interviewer"
              text="The AI speaks each question aloud. Answer naturally — no buttons to press. Speak, pause, continue, just like a real interview."
            />
            <StepCard
              num="03"
              icon="👁️"
              title="Real-time Analysis"
              text="While you answer, three AI agents silently analyze your confidence, eye contact, stress level, voice tone, and filler words."
            />
            <StepCard
              num="04"
              icon="📊"
              title="Detailed Report"
              text="Get a complete breakdown: overall score, strengths, weaknesses, action items, and a 'better answer' example for every question."
            />
          </div>

          {/* Features list */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <FeatureBlock
              title="🤖 Multi-Agent Intelligence"
              description="Unlike single-AI tools, we run four specialized agents in parallel — an Interviewer, an Evaluator, a Vision Analyzer, and a Coach. Each is great at one thing."
            />
            <FeatureBlock
              title="🎯 Personalized to You"
              description="The AI references your actual resume and the actual job description. Questions feel tailored, not generic. Get the practice that matters."
            />
            <FeatureBlock
              title="🔒 100% Private"
              description="Your webcam feed never leaves your browser. Face and emotion analysis runs locally. We only store your transcripts and scores."
            />
            <FeatureBlock
              title="⚡ Powered by Whisper + Gemini + Groq"
              description="State-of-the-art speech recognition catches technical terms accurately. Gemini conducts the interview. Groq scores answers in real-time."
            />
          </div>

          {/* Interview types */}
          <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-2xl p-8 backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-6 text-center">
              🎭 Practice Any Interview Type
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <InterviewType emoji="👋" label="Screening" />
              <InterviewType emoji="💼" label="Behavioral" />
              <InterviewType emoji="💻" label="Coding" />
              <InterviewType emoji="🏗️" label="System Design" />
              <InterviewType emoji="🤝" label="HR / Culture" />
            </div>
          </div>

          {/* Big CTA */}
          <div className="text-center mt-20">
            <Link
              href="/setup"
              className="inline-flex items-center gap-3 px-12 py-5 bg-linear-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:via-teal-300 hover:to-emerald-400 rounded-full font-bold text-xl text-slate-900 shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-400/70 transition-all hover:scale-105"
            >
              Begin Your First Interview
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <p className="text-sm text-emerald-300/60 mt-4">
              No credit card • No signup required • Start in 30 seconds
            </p>
          </div>
        </div>
      </section>

      {/* ====================================================
          FOOTER
      ==================================================== */}
      <footer className="relative py-8 px-4 border-t border-emerald-500/10 bg-emerald-950/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center font-bold text-xs">
              AI
            </div>
            <span className="text-emerald-100/70">
              AI Interview Coach
            </span>
          </div>

          <div className="text-emerald-100/50 text-center">
            © {new Date().getFullYear()} Built by{" "}
            <span className="text-emerald-300 font-semibold">Achyuth</span> • Made
            with multi-agent AI ✨
          </div>

          <div className="flex gap-4 text-emerald-100/50 text-xs">
            <span>Powered by Gemini + Groq + Whisper</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ====================================================
// Reusable components
// ====================================================

function StepCard({
  num,
  icon,
  title,
  text,
}: {
  num: string;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="group relative bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/20 hover:border-emerald-400/40 rounded-2xl p-6 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/10">
      <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-slate-900 font-bold text-sm shadow-lg">
        {num}
      </div>
      <div className="text-4xl mb-3 mt-2">{icon}</div>
      <h3 className="font-bold text-lg mb-2 text-emerald-100">{title}</h3>
      <p className="text-sm text-emerald-100/70 leading-relaxed">{text}</p>
    </div>
  );
}

function FeatureBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-emerald-950/30 border-l-4 border-emerald-400 rounded-r-xl p-6 backdrop-blur-sm hover:bg-emerald-900/30 transition-all">
      <h3 className="font-bold text-lg mb-2 text-emerald-200">{title}</h3>
      <p className="text-emerald-100/70 leading-relaxed">{description}</p>
    </div>
  );
}

function InterviewType({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-950/50 hover:bg-emerald-800/40 transition-all border border-emerald-500/10 hover:border-emerald-400/30 cursor-default">
      <span className="text-3xl">{emoji}</span>
      <span className="text-sm font-semibold text-emerald-100">{label}</span>
    </div>
  );
}