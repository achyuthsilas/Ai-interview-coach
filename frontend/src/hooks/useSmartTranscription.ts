"use client";

import { API_URL } from "@/lib/config";

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

  // Recognition is created fresh per recording session (see startRecording).
  // A persistent instance breaks after a few stop/start cycles in Chrome.

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

      // Create a FRESH SpeechRecognition instance for this session.
      // Reusing the same instance across questions causes it to silently
      // stop working after a few stop/start cycles in Chrome.
      const SpeechRecognition =
        (typeof window !== "undefined" &&
          (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
        null;
      if (SpeechRecognition) {
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
              interim = event.results[i][0].transcript;
            }
          }
          if (newFinalized) previewFinalizedRef.current += newFinalized;
          setLivePreview(previewFinalizedRef.current + interim);
        };

        recognition.onerror = (event: any) => {
          if (event.error === "network") {
            // Google's speech servers unreachable — kill the restart loop.
            // Whisper will still transcribe the final answer from the audio recording.
            shouldRestartRef.current = false;
          } else if (event.error !== "no-speech" && event.error !== "aborted") {
            console.warn("Preview recognition error:", event.error);
          }
        };

        // 100ms delay before restarting prevents InvalidStateError race condition
        recognition.onend = () => {
          if (shouldRestartRef.current) {
            setTimeout(() => {
              if (shouldRestartRef.current) {
                try { recognition.start(); } catch (e) {}
              }
            }, 100);
          }
        };

        recognitionRef.current = recognition;
        shouldRestartRef.current = true;
        try { recognition.start(); } catch (e) {}
      }

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
      if (audioBlob.size < 200) {
        // Less than 200 bytes → empty recording, skip Whisper call
        return "";
      }

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      const url = sessionId
  ? `${API_URL}/api/voice/transcribe?session_id=${sessionId}`
  : `${API_URL}/api/voice/transcribe`;

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
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }

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
        resolve(finalTranscriptRef.current || previewFinalizedRef.current);
        return;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        // Capture preview text before cleanup clears speech recognition
        const previewFallback = previewFinalizedRef.current.trim();
        cleanupRecording();

        if (audioChunksRef.current.length === 0) {
          resolve(previewFallback);
          return;
        }

        // Send the ENTIRE recording to Whisper at once
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        setIsTranscribing(true);
        const whisperText = await sendToWhisper(audioBlob);
        setIsTranscribing(false);

        // Prefer Whisper result; fall back to Web Speech API preview if Whisper returns empty
        const finalText = whisperText.trim() || previewFallback;
        setFinalTranscript(finalText);
        audioChunksRef.current = [];
        resolve(finalText);
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