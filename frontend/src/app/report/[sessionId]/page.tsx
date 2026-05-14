"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/config";

interface Report {
  overall_score: number;
  summary: string;
  top_strengths: string;
  top_weaknesses: string;
  action_items: string;
  recurring_patterns: string;
}

interface Evaluation {
  question: string;
  answer: string;
  overall_score: number;
  strengths: string;
  weaknesses: string;
  better_answer: string;
}

interface Metrics {
  avg_confidence: number;
  avg_eye_contact: number;
  avg_stress: number;
  dominant_emotion: string;
  total_filler_words: number;
  filler_word_breakdown: Record<string, number>;
  avg_volume: number;
  speaking_time_seconds: number;
  silent_time_seconds: number;
}

function getScoreStyle(score: number, max = 10) {
  const pct = (score / max) * 100;
  if (pct >= 75) return { text: "text-emerald-400", bar: "bg-emerald-500", ring: "#34d399", badge: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" };
  if (pct >= 50) return { text: "text-yellow-400", bar: "bg-yellow-500", ring: "#facc15", badge: "bg-yellow-500/15 border-yellow-500/40 text-yellow-400" };
  return { text: "text-red-400", bar: "bg-red-500", ring: "#f87171", badge: "bg-red-500/15 border-red-500/40 text-red-400" };
}

function ScoreRing({ score, max = 10, size = 96 }: { score: number; max?: number; size?: number }) {
  const pct = score / max;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const style = getScoreStyle(score, max);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#0f2e26" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={style.ring} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-xl font-bold leading-none ${style.text}`}>{score}</span>
        <span className="text-[9px] text-emerald-100/40 leading-none">/{max}</span>
      </div>
    </div>
  );
}

function Bulleted({ text, color = "text-emerald-100/80" }: { text: string; color?: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <ul className="space-y-2">
      {lines.map((line, idx) => (
        <li key={idx} className={`flex gap-2 leading-relaxed text-base ${color}`}>
          <span className="shrink-0 mt-0.5">•</span>
          <span>{line.replace(/^[-•*]\s*/, "")}</span>
        </li>
      ))}
    </ul>
  );
}

function StatBar({ label, value, max = 100, color = "bg-emerald-500" }: { label: string; value: number; max?: number; color?: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-emerald-100/60">{label}</span>
        <span className="text-emerald-100/90 font-semibold">{value}%</span>
      </div>
      <div className="h-2 bg-emerald-950/60 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | "overview">("overview");

  useEffect(() => {
    fetch(`${API_URL}/api/interview/${sessionId}/report`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data.report);
        setEvaluations(data.evaluations);
        setMetrics(data.metrics);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center bg-brand-gradient text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-emerald-100/60">Building your report…</p>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="h-screen flex items-center justify-center bg-brand-gradient text-white">
        <p className="text-emerald-100/60">Report not found.</p>
      </main>
    );
  }

  const overallStyle = getScoreStyle(report.overall_score, 100);
  const totalTime = metrics ? metrics.speaking_time_seconds + metrics.silent_time_seconds : 0;
  const speakingPct = totalTime > 0 ? Math.round((metrics!.speaking_time_seconds / totalTime) * 100) : 0;

  return (
    <div className="h-screen bg-brand-gradient text-white flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-emerald-500/20 bg-emerald-950/70 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-emerald-300/60 hover:text-emerald-300 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Home
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-sm font-bold tracking-widest uppercase text-emerald-300">
            Interview Report
          </h1>
        </div>

        <button
          onClick={() => router.push("/setup")}
          className="px-4 py-1.5 text-sm font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-emerald-300 transition-all"
        >
          Practice Again →
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <aside className="w-96 shrink-0 flex flex-col border-r border-emerald-500/15 bg-emerald-950/50 overflow-hidden">

          {/* Score hero */}
          <div className="p-5 border-b border-emerald-500/15">
            <div className="flex items-center gap-4">
              <div className="relative">
                <svg width="72" height="72" className="-rotate-90" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="28" fill="none" stroke="#0f2e26" strokeWidth="7" />
                  <circle
                    cx="36" cy="36" r="28" fill="none"
                    stroke={overallStyle.ring} strokeWidth="7"
                    strokeDasharray={`${2 * Math.PI * 28 * (report.overall_score / 100)} ${2 * Math.PI * 28}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-xl font-bold leading-none ${overallStyle.text}`}>{report.overall_score}</span>
                  <span className="text-[11px] text-emerald-100/40">/100</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-emerald-100/40 uppercase tracking-widest mb-0.5">Overall Score</p>
                <p className="text-sm text-emerald-100/60">{evaluations.length} questions answered</p>
                <div className={`mt-2 text-xs font-semibold px-2 py-0.5 rounded-full border inline-block ${overallStyle.badge}`}>
                  {report.overall_score >= 75 ? "Strong Performance" : report.overall_score >= 50 ? "Room to Improve" : "Needs Work"}
                </div>
              </div>
            </div>
          </div>

          {/* Overview button */}
          <div className="px-3 pt-3">
            <button
              onClick={() => setSelected("overview")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-semibold transition-all ${
                selected === "overview"
                  ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-md shadow-emerald-500/10"
                  : "text-emerald-100/50 hover:text-emerald-100 hover:bg-emerald-900/30 border border-transparent"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Overview & Analytics
            </button>
          </div>

          {/* Question list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            <p className="text-xs text-emerald-100/30 uppercase tracking-widest px-2 pb-1">
              Questions ({evaluations.length})
            </p>
            {evaluations.map((ev, idx) => {
              const s = getScoreStyle(ev.overall_score);
              const active = selected === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelected(idx)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-150 group ${
                    active
                      ? "bg-emerald-500/15 border-emerald-400/40 shadow-md shadow-emerald-500/10"
                      : "border-transparent hover:bg-emerald-900/30 hover:border-emerald-500/15"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-sm font-bold uppercase tracking-wider ${active ? "text-emerald-400" : "text-emerald-100/40"}`}>
                      Q{idx + 1}
                    </span>
                    <span className={`text-sm font-bold ${s.text}`}>{ev.overall_score}/10</span>
                  </div>
                  <p className="text-sm text-emerald-100/65 line-clamp-2 leading-relaxed group-hover:text-emerald-100/80 transition-colors">
                    {ev.question}
                  </p>
                  <div className="mt-2 h-1 bg-emerald-950/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${s.bar} rounded-full`}
                      style={{ width: `${ev.overall_score * 10}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 overflow-y-auto">
          {selected === "overview" ? (
            <OverviewPanel report={report} metrics={metrics} speakingPct={speakingPct} />
          ) : (
            <QuestionDetail evaluation={evaluations[selected as number]} idx={selected as number} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   OVERVIEW PANEL
═══════════════════════════════════════ */
function OverviewPanel({ report, metrics, speakingPct }: { report: Report; metrics: Metrics | null; speakingPct: number }) {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-emerald-100 mb-1">Session Overview</h2>
        <p className="text-sm text-emerald-100/40">Your full performance breakdown</p>
      </div>

      {/* Metrics — top */}
      {metrics && (
        <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-5">📊 Body Language & Voice</h3>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
            <StatBar label="Confidence" value={metrics.avg_confidence} color="bg-emerald-500" />
            <StatBar label="Eye Contact" value={metrics.avg_eye_contact} color="bg-teal-500" />
            <StatBar label="Stress Level" value={metrics.avg_stress} color={metrics.avg_stress > 50 ? "bg-red-500" : "bg-yellow-500"} />
            <StatBar label="Speaking Time" value={speakingPct} color="bg-sky-500" />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-950/60 border border-emerald-500/15 rounded-xl p-3">
              <div className="text-xl font-bold text-emerald-300">{metrics.dominant_emotion}</div>
              <div className="text-xs text-emerald-100/40 mt-0.5 capitalize">Dominant Mood</div>
            </div>
            <div className="bg-emerald-950/60 border border-emerald-500/15 rounded-xl p-3">
              <div className="text-xl font-bold text-yellow-300">{metrics.total_filler_words}</div>
              <div className="text-xs text-emerald-100/40 mt-0.5">Filler Words</div>
            </div>
            <div className="bg-emerald-950/60 border border-emerald-500/15 rounded-xl p-3">
              <div className="text-xl font-bold text-sky-300">{metrics.avg_volume}/100</div>
              <div className="text-xs text-emerald-100/40 mt-0.5">Avg Volume</div>
            </div>
          </div>

          {Object.keys(metrics.filler_word_breakdown || {}).length > 0 && (
            <div className="mt-4 pt-4 border-t border-emerald-500/15">
              <p className="text-[11px] text-emerald-100/40 uppercase tracking-widest mb-2">Filler word breakdown</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(metrics.filler_word_breakdown).map(([word, count]) => (
                  <span key={word} className="bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1 rounded-full text-xs text-yellow-300">
                    &quot;{word}&quot; × {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-3">📝 Summary</h3>
        <p className="text-emerald-100/80 leading-relaxed text-base">{report.summary}</p>
      </div>

      {/* Strengths + Weaknesses */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-3">✅ Top Strengths</h3>
          <Bulleted text={report.top_strengths} color="text-emerald-100/80" />
        </div>
        <div className="bg-emerald-950/50 border border-yellow-500/15 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-yellow-400 mb-3">⚠️ Areas to Improve</h3>
          <Bulleted text={report.top_weaknesses} color="text-yellow-100/70" />
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-emerald-950/50 border border-teal-500/20 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-teal-400 mb-3">🎯 Action Items</h3>
        <Bulleted text={report.action_items} color="text-teal-100/80" />
      </div>

      {report.recurring_patterns && report.recurring_patterns !== "No prior data" && (
        <div className="bg-emerald-950/50 border border-purple-500/20 rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">🔁 Patterns from Past Sessions</h3>
          <p className="text-emerald-100/80 text-sm leading-relaxed">{report.recurring_patterns}</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   QUESTION DETAIL PANEL
═══════════════════════════════════════ */
function QuestionDetail({ evaluation, idx }: { evaluation: Evaluation; idx: number }) {
  const s = getScoreStyle(evaluation.overall_score);

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400/70 mb-2">
            Question {idx + 1}
          </p>
          <h2 className="text-xl font-bold text-emerald-100 leading-snug">
            {evaluation.question}
          </h2>
        </div>
        <div className="shrink-0">
          <ScoreRing score={evaluation.overall_score} size={88} />
        </div>
      </div>

      {/* Score bar */}
      <div className="bg-emerald-950/50 border border-emerald-500/15 rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-sm text-emerald-100/40 uppercase tracking-widest">Answer Score</span>
          <span className={`font-bold ${s.text}`}>{evaluation.overall_score}/10</span>
        </div>
        <div className="h-2.5 bg-emerald-950/80 rounded-full overflow-hidden">
          <div
            className={`h-full ${s.bar} rounded-full transition-all duration-700`}
            style={{ width: `${evaluation.overall_score * 10}%` }}
          />
        </div>
      </div>

      {/* Your Answer */}
      <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Your Answer
        </h3>
        <p className="text-base text-emerald-100/75 leading-relaxed italic">
          &ldquo;{evaluation.answer}&rdquo;
        </p>
      </div>

      {/* Strengths + Weaknesses */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-emerald-950/50 border border-emerald-500/25 rounded-2xl p-5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">✓</span>
            Strengths
          </h3>
          <Bulleted text={evaluation.strengths} color="text-emerald-100/80" />
        </div>
        <div className="bg-emerald-950/50 border border-yellow-500/20 rounded-2xl p-5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-yellow-400 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center text-[11px]">!</span>
            Weaknesses
          </h3>
          <Bulleted text={evaluation.weaknesses} color="text-yellow-100/75" />
        </div>
      </div>

      {/* Better Answer */}
      <div className="bg-gradient-to-br from-teal-950/60 to-emerald-950/60 border border-teal-500/25 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-teal-400 mb-3 flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          Model Answer
        </h3>
        <p className="text-base text-teal-100/80 leading-relaxed">{evaluation.better_answer}</p>
      </div>
    </div>
  );
}
