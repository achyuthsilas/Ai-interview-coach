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

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8000/api/interview/${sessionId}/report`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data.report);
        setEvaluations(data.evaluations);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        Loading your report...
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Your Interview Report</h1>
          <div className={`text-7xl font-bold ${scoreColor}`}>
            {report.overall_score}
          </div>
          <div className="text-slate-400 mt-2">Overall Score / 100</div>
        </div>

        {/* Summary */}
        <Section title="Summary">
          <p className="text-slate-300 leading-relaxed">{report.summary}</p>
        </Section>

        {/* Strengths */}
        <Section title="✅ Top Strengths" accent="green">
          <Bulleted text={report.top_strengths} />
        </Section>

        {/* Weaknesses */}
        <Section title="⚠️ Areas to Improve" accent="yellow">
          <Bulleted text={report.top_weaknesses} />
        </Section>

        {/* Action Items */}
        <Section title="🎯 Action Items">
          <Bulleted text={report.action_items} />
        </Section>

        {/* Recurring Patterns */}
        {report.recurring_patterns &&
          report.recurring_patterns !== "No prior data" && (
            <Section title="🔁 Patterns from Past Sessions">
              <p className="text-slate-300">{report.recurring_patterns}</p>
            </Section>
          )}

        {/* Per-Question Breakdown */}
        <Section title="📋 Question-by-Question Breakdown">
          <div className="space-y-4">
            {evaluations.map((evaluation, idx) => (
              <div
                key={idx}
                className="bg-slate-900/50 rounded-lg p-5 border border-slate-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-blue-400">
                    Question {idx + 1}
                  </h3>
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
                  <strong className="text-purple-300 text-sm">
                    💡 Better answer:
                  </strong>
                  <p className="text-slate-300 text-sm mt-1">
                    {evaluation.better_answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <div className="text-center pt-6">
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
    <div className={`bg-slate-800/50 border ${borderColor} rounded-xl p-6`}>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
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