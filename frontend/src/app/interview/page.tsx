"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSmartTranscription } from "@/hooks/useSmartTranscription";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useVisionAnalysis } from "@/hooks/useVisionAnalysis";
import { useVoiceAnalysis } from "@/hooks/useVoiceAnalysis";

interface ChatMessage {
  role: "interviewer" | "candidate";
  content: string;
}

type Phase =
  | "loading"
  | "ai_speaking"
  | "initial_wait"
  | "user_speaking"
  | "silence_wait"
  | "submitting"
  | "complete";

const INITIAL_WAIT_MS = 45_000;
const SILENCE_RESET_MS = 20_000;

export default function Interview() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [phase, setPhase] = useState<Phase>("loading");
  const [countdown, setCountdown] = useState(0);

  const transcription = useSmartTranscription(sessionId);
  const synthesis = useSpeechSynthesis();
  const vision = useVisionAnalysis();
  const voice = useVoiceAnalysis();

  const submitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownEndRef = useRef<number>(0);
  const handledMessageIndexRef = useRef(-1);
  const isSubmittingRef = useRef(false);

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

    const startAll = async () => {
      await vision.start();
      await voice.start();
    };
    startAll();

    return () => {
      vision.stop();
      voice.stop();
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const clearAllTimers = useCallback(() => {
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(0);
  }, []);

  const startTimer = useCallback(
    (durationMs: number, onExpire: () => void) => {
      clearAllTimers();
      countdownEndRef.current = Date.now() + durationMs;
      setCountdown(Math.ceil(durationMs / 1000));

      countdownTimerRef.current = setInterval(() => {
        const remaining = countdownEndRef.current - Date.now();
        if (remaining <= 0) setCountdown(0);
        else setCountdown(Math.ceil(remaining / 1000));
      }, 200);

      submitTimerRef.current = setTimeout(onExpire, durationMs);
    },
    [clearAllTimers]
  );

  // Handle new interviewer messages
  useEffect(() => {
    if (messages.length === 0) return;
    const lastIndex = messages.length - 1;
    const last = messages[lastIndex];
    if (last.role !== "interviewer") return;
    if (handledMessageIndexRef.current >= lastIndex) return;
    if (phase === "complete") return;

    handledMessageIndexRef.current = lastIndex;
    setPhase("ai_speaking");

    synthesis.speak(last.content, () => {
      transitionToInitialWait();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, synthesis, phase]);

  const transitionToInitialWait = useCallback(async () => {
    isSubmittingRef.current = false;
    transcription.reset();
    await transcription.startRecording();
    setPhase("initial_wait");

    startTimer(INITIAL_WAIT_MS, async () => {
      const final = await transcription.stopRecording();
      handleSubmit(final || "(No answer — candidate was silent)");
    });
  }, [transcription, startTimer]);

  const transitionToUserSpeaking = useCallback(() => {
    clearAllTimers();
    setPhase("user_speaking");
  }, [clearAllTimers]);

  const transitionToSilenceWait = useCallback(async () => {
    setPhase("silence_wait");
    // No more mid-recording flush — we'll transcribe at the end
    startTimer(SILENCE_RESET_MS, async () => {
      const final = await transcription.stopRecording();
      handleSubmit(final);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTimer, transcription]);

  useEffect(() => {
    if (
      phase !== "initial_wait" &&
      phase !== "user_speaking" &&
      phase !== "silence_wait"
    ) {
      return;
    }

    if (transcription.isActivelySpeaking) {
      if (phase !== "user_speaking") transitionToUserSpeaking();
    } else {
      if (phase === "user_speaking") transitionToSilenceWait();
    }
  }, [
    transcription.isActivelySpeaking,
    phase,
    transitionToUserSpeaking,
    transitionToSilenceWait,
  ]);

  const handleSubmit = useCallback(
    async (answer: string) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      clearAllTimers();
      setPhase("submitting");

      const finalAnswer = answer.trim() || "(No answer provided)";
      setMessages((prev) => [...prev, { role: "candidate", content: finalAnswer }]);
      voice.countFillerWords(finalAnswer);

      try {
        const res = await fetch("http://localhost:8000/api/interview/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, answer: finalAnswer }),
        });
        const data = await res.json();
        setQuestionNumber(data.question_number);

        if (data.is_complete) {
          // Set complete phase BEFORE adding the closing message so the messages
          // effect sees phase="complete" and does not start a new recording cycle.
          setPhase("complete");
          setMessages((prev) => [
            ...prev,
            { role: "interviewer", content: data.interviewer_message },
          ]);
          await saveFinalMetrics();
        } else {
          isSubmittingRef.current = false;
          setMessages((prev) => [
            ...prev,
            { role: "interviewer", content: data.interviewer_message },
          ]);
        }
      } catch (err) {
        isSubmittingRef.current = false;
        setMessages((prev) => [
          ...prev,
          {
            role: "interviewer",
            content: "Sorry, something went wrong. Please try again.",
          },
        ]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, voice, clearAllTimers]
  );

  const saveFinalMetrics = async () => {
    const visionAgg = vision.getAggregated();
    const voiceAgg = voice.getAggregated();
    const payload = {
      avg_confidence: visionAgg.avgConfidence,
      avg_eye_contact: visionAgg.avgEyeContact,
      avg_stress: visionAgg.avgStress,
      dominant_emotion: visionAgg.dominantEmotion,
      total_filler_words: voiceAgg.totalFillerWords,
      filler_word_breakdown: voiceAgg.fillerWordBreakdown,
      avg_volume: voiceAgg.avgVolume,
      speaking_time_seconds: voiceAgg.speakingTimeSeconds,
      silent_time_seconds: voiceAgg.silentTimeSeconds,
    };
    try {
      await fetch(`http://localhost:8000/api/interview/${sessionId}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Failed to save metrics:", err);
    }
  };

  const handleManualSubmit = async () => {
    const final = await transcription.stopRecording();
    handleSubmit(final);
  };

  const handleSkip = async () => {
    // Stop recording without sending answer — submit "skipped"
    await transcription.stopRecording();
    handleSubmit("(Candidate chose to skip this question)");
  };

  const phaseInfo = {
    loading: { label: "Loading...", color: "text-slate-400", showTimer: false },
    ai_speaking: { label: "🔊 Interviewer is speaking", color: "text-blue-400", showTimer: false },
    initial_wait: { label: "🤔 Take your time...", color: "text-slate-300", showTimer: true },
    user_speaking: { label: "🎤 Listening...", color: "text-green-400", showTimer: false },
    silence_wait: { label: "⏸️ Paused — keep going or wait", color: "text-yellow-400", showTimer: true },
    submitting: { label: "✨ Transcribing & evaluating...", color: "text-purple-400", showTimer: false },
    complete: { label: "✅ Complete", color: "text-green-400", showTimer: false },
  }[phase];

  const isComplete = phase === "complete";
  const isListening =
    phase === "initial_wait" || phase === "user_speaking" || phase === "silence_wait";

  const displayTranscript = transcription.livePreview || "";

  return (
    <main className="h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white overflow-hidden flex flex-col">
      <header className="px-6 py-3 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="text-sm font-semibold">
          {company} • Question {questionNumber} / 5
        </div>
        <div className="flex items-center gap-4 text-sm">
          {phaseInfo.showTimer && countdown > 0 && (
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  phase === "initial_wait" ? "bg-blue-400" : "bg-yellow-400"
                } animate-pulse`}
              />
              <span className="font-mono font-bold text-lg">{countdown}s</span>
            </div>
          )}
          <span className={phaseInfo.color}>{phaseInfo.label}</span>
        </div>
      </header>

      <div className="flex-1 relative">
        <video
          ref={vision.videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />

        {!vision.isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div>Loading camera & AI vision models...</div>
            </div>
          </div>
        )}

        {vision.isReady && (
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md rounded-xl p-3 min-w-[180px] border border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              Live Analysis
            </div>
            <MetricBar label="Confidence" value={vision.metrics.confidence} color="green" />
            <MetricBar label="Eye Contact" value={vision.metrics.eyeContact} color="blue" />
            <MetricBar label="Stress" value={vision.metrics.stressLevel} color="red" />
            <MetricBar label="Volume" value={voice.metrics.volume} color="purple" />
            <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-white/10">
              Mood:{" "}
              <span className="text-white capitalize font-semibold">
                {vision.metrics.emotion}
              </span>
            </div>
          </div>
        )}

        {transcription.isActivelySpeaking && (
          <div className="absolute top-4 right-4 bg-green-500/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold animate-pulse">
            ● Listening
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-6 pb-8">
          <div className="max-w-4xl mx-auto">
            {messages.length > 0 &&
              messages[messages.length - 1].role === "interviewer" && (
                <div className="mb-4 text-xl leading-relaxed font-medium text-white drop-shadow-lg">
                  {messages[messages.length - 1].content}
                </div>
              )}

            {displayTranscript && isListening && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-5 py-3 mb-3">
                <div className="text-xs text-blue-300 mb-1">
                  Your answer (live preview — final transcription happens when you submit):
                </div>
                <div className="text-base text-white">{displayTranscript}</div>
              </div>
            )}

            {phase === "submitting" && (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-2 flex gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
                {transcription.isTranscribing && (
                  <div className="text-xs text-slate-300">
                    Whisper is transcribing your full answer...
                  </div>
                )}
              </div>
            )}

            {/* Submit + Skip buttons */}
            {!isComplete && isListening && (
              <div className="flex justify-center gap-3 mt-3">
                <button
                  onClick={handleManualSubmit}
                  className="px-6 py-2 bg-blue-600/80 hover:bg-blue-600 backdrop-blur-md rounded-lg font-medium transition-all"
                >
                  Submit Answer →
                </button>
                <button
                  onClick={handleSkip}
                  className="px-6 py-2 bg-slate-700/80 hover:bg-slate-600 backdrop-blur-md rounded-lg font-medium transition-all"
                  title="Skip this question"
                >
                  ⏭️ Skip
                </button>
              </div>
            )}

            {isComplete && (
              <div className="text-center space-y-3">
                <p className="text-lg text-green-400">✅ Interview Complete!</p>
                <button
                  onClick={() => {
                    const id = sessionId;
                    localStorage.removeItem("interviewSession");
                    router.push(`/report/${id}`);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-semibold transition-all"
                >
                  View Your Report →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "blue" | "red" | "purple";
}) {
  const colorMap = {
    green: "from-green-500 to-emerald-400",
    blue: "from-blue-500 to-cyan-400",
    red: "from-red-500 to-orange-400",
    purple: "from-purple-500 to-pink-400",
  };
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-bold">{value}%</span>
      </div>
      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colorMap[color]} transition-all duration-300`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}