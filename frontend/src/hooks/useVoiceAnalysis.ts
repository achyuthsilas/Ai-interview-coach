"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Meyda from "meyda";

export interface VoiceMetrics {
  volume: number;
  pitch: number;
  pace: string;
  fillerWordCount: number;
  isSpeaking: boolean;
}

export interface AggregatedVoiceMetrics {
  avgVolume: number;
  speakingTimeSeconds: number;
  silentTimeSeconds: number;
  totalFillerWords: number;
  fillerWordBreakdown: Record<string, number>;
}

const FILLER_WORDS = [
  "um", "uh", "umm", "uhh", "like", "you know", "basically",
  "actually", "literally", "sort of", "kind of", "right", "okay so",
];

export function useVoiceAnalysis() {
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

  // Aggregation refs (don't trigger re-renders)
  const volumeSamplesRef = useRef<number[]>([]);
  const speakingFramesRef = useRef(0);
  const silentFramesRef = useRef(0);
  const fillerBreakdownRef = useRef<Record<string, number>>({});

  const countFillerWords = useCallback((text: string): number => {
    const lower = " " + text.toLowerCase() + " ";
    let total = 0;
    FILLER_WORDS.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, "g");
      const matches = lower.match(regex);
      const count = matches?.length || 0;
      if (count > 0) {
        fillerBreakdownRef.current[word] =
          (fillerBreakdownRef.current[word] || 0) + count;
        total += count;
      }
    });
    return total;
  }, []);

  const getAggregated = useCallback((): AggregatedVoiceMetrics => {
    const samples = volumeSamplesRef.current;
    const avgVolume =
      samples.length > 0
        ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
        : 0;

    // Each frame is ~100ms (we sample at 10Hz approximately)
    const speakingSeconds = Math.round(speakingFramesRef.current / 10);
    const silentSeconds = Math.round(silentFramesRef.current / 10);

    const totalFillers = Object.values(fillerBreakdownRef.current).reduce(
      (a, b) => a + b,
      0
    );

    return {
      avgVolume,
      speakingTimeSeconds: speakingSeconds,
      silentTimeSeconds: silentSeconds,
      totalFillerWords: totalFillers,
      fillerWordBreakdown: { ...fillerBreakdownRef.current },
    };
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
          const isSpeaking = volume > 8;

          // Aggregate
          volumeSamplesRef.current.push(volume);
          if (isSpeaking) speakingFramesRef.current++;
          else silentFramesRef.current++;

          setMetrics({
            volume,
            pitch,
            pace: "normal",
            fillerWordCount: Object.values(fillerBreakdownRef.current).reduce(
              (a, b) => a + b, 0
            ),
            isSpeaking,
          });
        },
      });

      analyzer.start();
      analyzerRef.current = analyzer;
    } catch (err) {
      setError("Microphone access denied");
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

  return { metrics, start, stop, countFillerWords, getAggregated, error };
}