"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useWhisperFallback } from "@/hooks/useWhisperFallback";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useVisionAnalysis } from "@/hooks/useVisionAnalysis";
import { useVoiceAnalysis } from "@/hooks/useVoiceAnalysis";
import { WebcamPanel } from "@/components/WebcamPanel";

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
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [totalFillerWords, setTotalFillerWords] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hooks
  const speech = useSpeechRecognition();
  const whisper = useWhisperFallback();
  const synthesis = useSpeechSynthesis();
  const vision = useVisionAnalysis();
  const voice = useVoiceAnalysis();

  const useWhisper = !speech.isSupported;

  // Update answer from speech
  useEffect(() => {
    if (speech.transcript) setCurrentAnswer(speech.transcript);
  }, [speech.transcript]);

  // Load session
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

  // Auto-speak interviewer messages
  useEffect(() => {
    if (!autoSpeak) return;
    const last = messages[messages.length - 1];
    if (last && last.role === "interviewer") {
      synthesis.speak(last.content);
    }
  }, [messages, autoSpeak, synthesis]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const enableCamera = () => setCameraEnabled(true);

  const disableCamera = () => {
    vision.stop();
    voice.stop();
    setCameraEnabled(false);
  };

  // Start vision/voice AFTER cameraEnabled=true so WebcamPanel (and its
  // <video> element) is in the DOM before vision.start() tries to attach the stream.
  useEffect(() => {
    if (cameraEnabled) {
      vision.start();
      voice.start();
    }
  }, [cameraEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || loading || isComplete) return;

    if (speech.isListening) speech.stopListening();

    const userMessage = currentAnswer;
    setCurrentAnswer("");
    speech.resetTranscript();
    setMessages((prev) => [...prev, { role: "candidate", content: userMessage }]);
    setLoading(true);

    // Count filler words in this answer
    const fillers = voice.countFillerWords(userMessage);
    setTotalFillerWords((prev) => prev + fillers);

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

      if (data.is_complete) disableCamera();
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

  const toggleVoiceInput = async () => {
    if (useWhisper) {
      if (whisper.isRecording) {
        const text = await whisper.stopRecording();
        setCurrentAnswer((prev) => (prev + " " + text).trim());
      } else {
        await whisper.startRecording();
      }
    } else {
      if (speech.isListening) speech.stopListening();
      else {
        speech.resetTranscript();
        setCurrentAnswer("");
        speech.startListening();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const isRecording = useWhisper ? whisper.isRecording : speech.isListening;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">{company} Interview</h1>
            <p className="text-sm text-slate-400">
              Question {questionNumber} of 5
              {useWhisper && <span className="ml-2 text-yellow-400">(Whisper mode)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={cameraEnabled ? disableCamera : enableCamera}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                cameraEnabled
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-slate-700 hover:bg-slate-600"
              }`}
            >
              📹 {cameraEnabled ? "Camera On" : "Enable Camera"}
            </button>
            <button
              onClick={() => {
                if (synthesis.isSpeaking) synthesis.cancel();
                setAutoSpeak((v) => !v);
              }}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                autoSpeak ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-700 hover:bg-slate-600"
              }`}
            >
              🔊 {autoSpeak ? "Voice On" : "Voice Off"}
            </button>
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                style={{ width: `${(questionNumber / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Webcam panel */}
          {cameraEnabled && (
            <div className="lg:col-span-1">
              <WebcamPanel
                videoRef={vision.videoRef}
                visionMetrics={vision.metrics}
                voiceMetrics={voice.metrics}
                fillerWordCount={totalFillerWords}
                isReady={vision.isReady}
              />
            </div>
          )}

          {/* Chat area */}
          <div className={`${cameraEnabled ? "lg:col-span-2" : "lg:col-span-3"} flex flex-col overflow-hidden`}>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                        msg.role === "candidate"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 border border-slate-700 text-slate-100"
                      }`}
                    >
                      <div className="text-xs uppercase tracking-wider mb-1 opacity-60">
                        {msg.role === "candidate" ? "You" : "Interviewer"}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
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
            <div className="border-t border-slate-700 pt-4 mt-4">
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
                <div className="space-y-3">
                  {speech.interimTranscript && (
                    <div className="text-sm text-slate-400 italic px-2">
                      Listening... &quot;{speech.interimTranscript}&quot;
                    </div>
                  )}

                  {whisper.isTranscribing && (
                    <div className="text-sm text-yellow-400 px-2">
                      Transcribing your answer...
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={toggleVoiceInput}
                      disabled={loading || whisper.isTranscribing}
                      className={`px-5 rounded-lg font-semibold transition-all min-w-[60px] ${
                        isRecording
                          ? "bg-red-600 hover:bg-red-700 animate-pulse"
                          : "bg-slate-700 hover:bg-slate-600"
                      } disabled:opacity-50`}
                    >
                      {isRecording ? "🔴" : "🎤"}
                    </button>

                    <textarea
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isRecording ? "Speak now..." : "Type or press the mic to speak..."}
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

                  {(speech.error || vision.error || voice.error) && (
                    <div className="text-sm text-red-400 px-2">
                      {speech.error || vision.error || voice.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}