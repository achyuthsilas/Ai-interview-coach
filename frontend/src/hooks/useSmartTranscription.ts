"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseSmartTranscriptionReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isActivelySpeaking: boolean;
  livePreview: string;
  finalTranscript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  reset: () => void;
}

// ============================================================
// AUDIO-LEVEL VOICE ACTIVITY DETECTION
// ============================================================
// We use actual audio energy (not Web Speech API) to detect speech.
// This is far more reliable across accents, technical terms, and pauses.

const SILENCE_THRESHOLD = 0.015;      // RMS below this = silence
const SPEECH_THRESHOLD = 0.025;       // RMS above this = speech
const SPEECH_CONFIRM_FRAMES = 3;      // ~150ms of speech to confirm
const SILENCE_CONFIRM_FRAMES = 30;    // ~1.5s of silence to confirm stop

// Speech Recognition types (used only for non-critical live preview)
interface SpeechRecognitionEvent extends Event {
  results: any;
  resultIndex: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionInstance };
    webkitSpeechRecognition?: { new (): SpeechRecognitionInstance };
  }
}

export function useSmartTranscription(sessionId: string): UseSmartTranscriptionReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isActivelySpeaking, setIsActivelySpeaking] = useState(false);
  const [livePreview, setLivePreview] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Audio recording (the source of truth)
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Audio analysis for VAD
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechFramesRef = useRef(0);
  const silenceFramesRef = useRef(0);
  const isSpeakingStateRef = useRef(false);

  // Speech recognition (non-critical, live preview only)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldRestartRef = useRef(false);
  // Accumulates finalized text across recognition restarts within one recording session
  const previewFinalizedRef = useRef("");

  // Setup speech recognition for live preview (best-effort, can fail silently)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let newFinalized = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newFinalized += event.results[i][0].transcript + " ";
        } else {
          // Last interim result only — Chrome may fire multiple, only show latest
          interim = event.results[i][0].transcript;
        }
      }
      if (newFinalized) previewFinalizedRef.current += newFinalized;
      // Replace preview: finalized text + current interim (no accumulation bug)
      setLivePreview(previewFinalizedRef.current + interim);
    };

    recognition.onerror = (event: any) => {
      // Silent fail — preview is non-critical
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Preview recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      recognition.abort();
    };
  }, []);

  // ============================================================
  // AUDIO-LEVEL VAD (the reliable speech detector)
  // ============================================================

  const setupVAD = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Float32Array(analyser.fftSize);

    // Reset counters
    speechFramesRef.current = 0;
    silenceFramesRef.current = 0;
    isSpeakingStateRef.current = false;

    // Sample audio energy every 50ms
    vadIntervalRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(dataArray);

      // Calculate RMS (root mean square = audio energy)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      const isLoud = rms > SPEECH_THRESHOLD;
      const isQuiet = rms < SILENCE_THRESHOLD;

      if (isLoud) {
        speechFramesRef.current++;
        silenceFramesRef.current = 0;

        // Confirm speech after enough consecutive loud frames
        if (
          !isSpeakingStateRef.current &&
          speechFramesRef.current >= SPEECH_CONFIRM_FRAMES
        ) {
          isSpeakingStateRef.current = true;
          setIsActivelySpeaking(true);
        }
      } else if (isQuiet) {
        silenceFramesRef.current++;
        speechFramesRef.current = 0;

        // Confirm silence after enough consecutive quiet frames
        if (
          isSpeakingStateRef.current &&
          silenceFramesRef.current >= SILENCE_CONFIRM_FRAMES
        ) {
          isSpeakingStateRef.current = false;
          setIsActivelySpeaking(false);
        }
      }
      // In-between (between thresholds) — don't change state, prevents flicker
    }, 50);
  }, []);

  // ============================================================
  // RECORDING CONTROLS
  // ============================================================

  const startRecording = useCallback(async () => {
    try {
      setLivePreview("");
      setFinalTranscript("");
      finalTranscriptRef.current = "";
      previewFinalizedRef.current = "";
      audioChunksRef.current = [];
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Capture in 500ms chunks, but NEVER clear until we stop
      mediaRecorder.start(500);

      // Start live preview (best effort)
      shouldRestartRef.current = true;
      try {
        recognitionRef.current?.start();
      } catch (e) {}

      // Start audio-level VAD
      setupVAD(stream);

      setIsRecording(true);
    } catch (err) {
      setError("Microphone access denied");
      console.error(err);
    }
  }, [setupVAD]);

  const sendToWhisper = useCallback(
    async (audioBlob: Blob): Promise<string> => {
      if (audioBlob.size < 1000) {
        // Less than 1KB → almost certainly no real speech
        return "";
      }

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      const url = sessionId
        ? `http://localhost:8000/api/voice/transcribe?session_id=${sessionId}`
        : "http://localhost:8000/api/voice/transcribe";

      try {
        const res = await fetch(url, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        return data.text || "";
      } catch (err) {
        console.error("Whisper failed:", err);
        return "";
      }
    },
    [sessionId]
  );

  const cleanupRecording = useCallback(() => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    speechFramesRef.current = 0;
    silenceFramesRef.current = 0;
    isSpeakingStateRef.current = false;
    setIsActivelySpeaking(false);
  }, []);

  const finalTranscriptRef = useRef("");
  useEffect(() => { finalTranscriptRef.current = finalTranscript; }, [finalTranscript]);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanupRecording();
        resolve(finalTranscriptRef.current);
        return;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        cleanupRecording();

        if (audioChunksRef.current.length === 0) {
          resolve("");
          return;
        }

        // Send the ENTIRE recording to Whisper at once
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        setIsTranscribing(true);
        const text = await sendToWhisper(audioBlob);
        setIsTranscribing(false);
        setFinalTranscript(text);
        audioChunksRef.current = [];
        resolve(text);
      };

      // Request the latest chunk before stopping
      recorder.requestData();
      recorder.stop();
    });
  }, [cleanupRecording, sendToWhisper]);

  const reset = useCallback(() => {
    setLivePreview("");
    setFinalTranscript("");
    audioChunksRef.current = [];
  }, []);

  return {
    isRecording,
    isTranscribing,
    isActivelySpeaking,
    livePreview,
    finalTranscript,
    error,
    startRecording,
    stopRecording,
    reset,
  };
}