"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8000/api/interview/${sessionId}/report`)
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
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          Loading your report...
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        Report not found.
      </main>
    );
  }

  const scoreColor =
    report.overall_score >= 75
      ? "text-green-400"
      : report.overall_score >= 50
      ? "text-yellow-400"
      : "text-red-400";

  const totalTime = metrics
    ? metrics.speaking_time_seconds + metrics.silent_time_seconds
    : 0;
  const speakingPercent =
    totalTime > 0 ? Math.round((metrics!.speaking_time_seconds / totalTime) * 100) : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-pink-400 bg-clip-text text-transparent">
            Your Interview Report
          </h1>
          <div className={`text-8xl font-bold ${scoreColor} drop-shadow-lg`}>
            {report.overall_score}
          </div>
          <div className="text-slate-400 mt-2">Overall Score / 100</div>
        </div>

        {/* Body Language + Voice Metrics */}
        {metrics && (
          <Section title="📊 Body Language & Voice Analysis">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                label="Confidence"
                value={`${metrics.avg_confidence}%`}
                emoji="😊"
                color="green"
              />
              <MetricCard
                label="Eye Contact"
                value={`${metrics.avg_eye_contact}%`}
                emoji="👁"
                color="blue"
              />
              <MetricCard
                label="Stress Level"
                value={`${metrics.avg_stress}%`}
                emoji="😰"
                color={metrics.avg_stress > 50 ? "red" : "green"}
              />
              <MetricCard
                label="Dominant Mood"
                value={metrics.dominant_emotion}
                emoji="🎭"
                color="purple"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="font-semibold mb-3 text-blue-400">🗣️ Speaking Pattern</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Time Speaking:</span>
                    <span>{metrics.speaking_time_seconds}s ({speakingPercent}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Time Silent:</span>
                    <span>{metrics.silent_time_seconds}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Average Volume:</span>
                    <span>{metrics.avg_volume}/100</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="font-semibold mb-3 text-yellow-400">
                  🚫 Filler Words ({metrics.total_filler_words} total)
                </h3>
                {Object.keys(metrics.filler_word_breakdown || {}).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(metrics.filler_word_breakdown).map(
                      ([word, count]) => (
                        <span
                          key={word}
                          className="bg-yellow-500/20 border border-yellow-500/40 px-2 py-1 rounded-full text-xs"
                        >
                          &quot;{word}&quot; × {count}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-green-400">
                    ✓ No filler words detected — clean speech!
                  </div>
                )}
              </div>
            </div>
          </Section>
        )}

        <Section title="📝 Summary">
          <p className="text-slate-300 leading-relaxed">{report.summary}</p>
        </Section>

        <Section title="✅ Top Strengths" accent="green">
          <Bulleted text={report.top_strengths} />
        </Section>

        <Section title="⚠️ Areas to Improve" accent="yellow">
          <Bulleted text={report.top_weaknesses} />
        </Section>

        <Section title="🎯 Action Items">
          <Bulleted text={report.action_items} />
        </Section>

        {report.recurring_patterns && report.recurring_patterns !== "No prior data" && (
          <Section title="🔁 Patterns from Past Sessions">
            <p className="text-slate-300">{report.recurring_patterns}</p>
          </Section>
        )}

        <Section title="📋 Question-by-Question Breakdown">
          <div className="space-y-4">
            {evaluations.map((evaluation, idx) => (
              <div
                key={idx}
                className="bg-slate-900/50 rounded-lg p-5 border border-slate-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-blue-400">Question {idx + 1}</h3>
                  <span className="text-2xl font-bold">
                    {evaluation.overall_score}/10
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  <strong>Q:</strong> {evaluation.question}
                </p>
                <p className="text-sm text-slate-300 mb-3">
                  <strong>Your answer:</strong> {evaluation.answer}
                </p>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="text-green-300">
                    <strong>✓ Strengths:</strong> {evaluation.strengths}
                  </div>
                  <div className="text-yellow-300">
                    <strong>⚠ Weaknesses:</strong> {evaluation.weaknesses}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <strong className="text-purple-300 text-sm">💡 Better answer:</strong>
                  <p className="text-slate-300 text-sm mt-1">{evaluation.better_answer}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="text-center pt-4">
          <button
            onClick={() => router.push("/setup")}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-semibold transition-all"
          >
            Practice Another Interview →
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: "green" | "yellow";
}) {
  const borderColor =
    accent === "green"
      ? "border-green-700"
      : accent === "yellow"
      ? "border-yellow-700"
      : "border-slate-700";

  return (
    <div className={`bg-slate-800/50 backdrop-blur-md border ${borderColor} rounded-xl p-6`}>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  emoji,
  color,
}: {
  label: string;
  value: string;
  emoji: string;
  color: "green" | "blue" | "red" | "purple";
}) {
  const colorMap = {
    green: "border-green-500/30 bg-green-500/10",
    blue: "border-blue-500/30 bg-blue-500/10",
    red: "border-red-500/30 bg-red-500/10",
    purple: "border-purple-500/30 bg-purple-500/10",
  };
  return (
    <div className={`border ${colorMap[color]} rounded-xl p-4 text-center`}>
      <div className="text-3xl mb-1">{emoji}</div>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-bold capitalize">{value}</div>
    </div>
  );
}

function Bulleted({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <ul className="space-y-2 text-slate-300">
      {lines.map((line, idx) => (
        <li key={idx} className="leading-relaxed">
          {line}
        </li>
      ))}
    </ul>
  );
}