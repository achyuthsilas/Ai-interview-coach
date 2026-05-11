"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Meyda from "meyda";

export interface VoiceMetrics {
  volume: number;          // 0-100
  pitch: number;           // Hz
  pace: string;            // "slow", "normal", "fast"
  fillerWordCount: number;
  isSpeaking: boolean;
}

const FILLER_WORDS = ["um", "uh", "like", "you know", "basically", "actually", "literally"];

interface UseVoiceAnalysisReturn {
  metrics: VoiceMetrics;
  start: () => Promise<void>;
  stop: () => void;
  countFillerWords: (text: string) => number;
  error: string | null;
}

export function useVoiceAnalysis(): UseVoiceAnalysisReturn {
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    volume: 0,
    pitch: 0,
    pace: "normal",
    fillerWordCount: 0,
    isSpeaking: false,
  });
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const countFillerWords = useCallback((text: string): number => {
    const lower = text.toLowerCase();
    return FILLER_WORDS.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}\\b`, "g");
      return count + (lower.match(regex)?.length || 0);
    }, 0);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      const analyzer = Meyda.createMeydaAnalyzer({
        audioContext,
        source,
        bufferSize: 512,
        featureExtractors: ["rms", "spectralCentroid", "energy"],
        callback: (features: any) => {
          const volume = Math.min(100, Math.round((features.rms || 0) * 500));
          const pitch = Math.round(features.spectralCentroid || 0);
          const isSpeaking = volume > 5;

          setMetrics((prev) => ({
            ...prev,
            volume,
            pitch,
            isSpeaking,
          }));
        },
      });

      analyzer.start();
      analyzerRef.current = analyzer;
    } catch (err) {
      setError("Microphone access denied");
      console.error(err);
    }
  }, []);

  const stop = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.stop();
      analyzerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { metrics, start, stop, countFillerWords, error };
}