"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ChatMessage {
  role: "interviewer" | "candidate";
  content: string;
}

export default function Interview() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load session on mount
  useEffect(() => {
    const sessionData = localStorage.getItem("interviewSession");
    if (!sessionData) {
      router.push("/setup");
      return;
    }

    const { sessionId, firstMessage, company } = JSON.parse(sessionData);
    setSessionId(sessionId);
    setCompany(company);
    setMessages([{ role: "interviewer", content: firstMessage }]);
  }, [router]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || loading || isComplete) return;

    const userMessage = currentAnswer;
    setCurrentAnswer("");
    setMessages((prev) => [...prev, { role: "candidate", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/interview/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, answer: userMessage }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "interviewer", content: data.interviewer_message },
      ]);
      setQuestionNumber(data.question_number);
      setIsComplete(data.is_complete);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "interviewer",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">{company} Interview</h1>
            <p className="text-sm text-slate-400">
              Question {questionNumber} of 5
            </p>
          </div>
          <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
              style={{ width: `${(questionNumber / 5) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "candidate" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                  msg.role === "candidate"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 border border-slate-700 text-slate-100"
                }`}
              >
                <div className="text-xs uppercase tracking-wider mb-1 opacity-60">
                  {msg.role === "candidate" ? "You" : "Interviewer"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-slate-700 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {isComplete ? (
          <div className="text-center space-y-4">
          <p className="text-lg text-green-400">
            ✅ Interview Complete! Your detailed report is ready.
          </p>
          <button
            onClick={() => {
              const id = sessionId;
              localStorage.removeItem("interviewSession");
              router.push(`/report/${id}`);
            }}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-semibold transition-all"
          >
            View Your Report →
          </button>
        </div>
      ) : (
            <div className="flex gap-3">
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer... (Shift+Enter for new line)"
                rows={3}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none resize-none disabled:opacity-50"
              />
              <button
                onClick={handleSubmitAnswer}
                disabled={loading || !currentAnswer.trim()}
                className="px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}