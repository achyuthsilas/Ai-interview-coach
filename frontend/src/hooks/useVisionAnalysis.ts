"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

export interface VisionMetrics {
  confidence: number;
  emotion: string;
  eyeContact: number;
  faceDetected: boolean;
  stressLevel: number;
}

export interface AggregatedVisionMetrics {
  avgConfidence: number;
  avgEyeContact: number;
  avgStress: number;
  dominantEmotion: string;
}

const DEFAULT_METRICS: VisionMetrics = {
  confidence: 0,
  emotion: "neutral",
  eyeContact: 0,
  faceDetected: false,
  stressLevel: 0,
};

export function useVisionAnalysis() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [metrics, setMetrics] = useState<VisionMetrics>(DEFAULT_METRICS);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const pendingStartRef = useRef(false);

  // Aggregation refs
  const confidenceSamplesRef = useRef<number[]>([]);
  const eyeContactSamplesRef = useRef<number[]>([]);
  const stressSamplesRef = useRef<number[]>([]);
  const emotionCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        setError("Failed to load vision models");
      }
    };
    loadModels();
  }, []);

  const getAggregated = useCallback((): AggregatedVisionMetrics => {
    const avg = (arr: number[]) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const emotions = emotionCountsRef.current;
    const dominantEmotion =
      Object.entries(emotions).reduce(
        (max, [k, v]) => (v > max[1] ? [k, v] : max),
        ["neutral", 0]
      )[0] as string;

    return {
      avgConfidence: avg(confidenceSamplesRef.current),
      avgEyeContact: avg(eyeContactSamplesRef.current),
      avgStress: avg(stressSamplesRef.current),
      dominantEmotion,
    };
  }, []);

  const analyze = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded) return;

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      if (!detection) {
        setMetrics((prev) => ({ ...prev, faceDetected: false }));
        return;
      }

      const expressions = detection.expressions;
      const landmarks = detection.landmarks;

      const dominant = Object.entries(expressions).reduce((max, curr) =>
        curr[1] > max[1] ? curr : max
      );

      const positiveScore =
        (expressions.happy + expressions.neutral + expressions.surprised) * 100;
      const confidence = Math.round(Math.min(positiveScore, 100));

      const stressScore =
        (expressions.fearful + expressions.angry + expressions.sad + expressions.disgusted) * 100;
      const stressLevel = Math.round(Math.min(stressScore, 100));

      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const nose = landmarks.getNose();
      const eyesMidX = (leftEye[0].x + rightEye[3].x) / 2;
      const noseX = nose[3].x;
      const offset = Math.abs(eyesMidX - noseX);
      const faceWidth = Math.abs(rightEye[3].x - leftEye[0].x);
      const eyeContactScore = Math.max(0, 100 - (offset / faceWidth) * 200);

      // Aggregate
      confidenceSamplesRef.current.push(confidence);
      eyeContactSamplesRef.current.push(Math.round(eyeContactScore));
      stressSamplesRef.current.push(stressLevel);
      emotionCountsRef.current[dominant[0]] =
        (emotionCountsRef.current[dominant[0]] || 0) + 1;

      setMetrics({
        confidence,
        emotion: dominant[0],
        eyeContact: Math.round(eyeContactScore),
        faceDetected: true,
        stressLevel,
      });
    } catch (err) {
      // Silent fail per frame
    }
  }, [modelsLoaded]);

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsReady(true);
      setError(null);
      intervalRef.current = setInterval(analyze, 500);
    } catch (err) {
      setError("Camera access denied");
    }
  }, [analyze]);

  // Auto-start camera once models finish loading (if start() was called early)
  useEffect(() => {
    if (modelsLoaded && pendingStartRef.current) {
      pendingStartRef.current = false;
      openCamera();
    }
  }, [modelsLoaded, openCamera]);

  const start = useCallback(async () => {
    if (!modelsLoaded) {
      pendingStartRef.current = true;
      return;
    }
    await openCamera();
  }, [modelsLoaded, openCamera]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsReady(false);
    setMetrics(DEFAULT_METRICS);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { videoRef, metrics, isReady, error, start, stop, getAggregated };
}