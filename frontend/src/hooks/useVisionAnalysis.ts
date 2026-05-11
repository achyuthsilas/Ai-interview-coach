"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

export interface VisionMetrics {
  confidence: number;          // 0-100
  emotion: string;             // "happy", "neutral", "sad", etc.
  eyeContact: number;          // 0-100
  faceDetected: boolean;
  stressLevel: number;         // 0-100 (higher = more stress)
}

interface UseVisionAnalysisReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  metrics: VisionMetrics;
  isReady: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

const DEFAULT_METRICS: VisionMetrics = {
  confidence: 0,
  emotion: "neutral",
  eyeContact: 0,
  faceDetected: false,
  stressLevel: 0,
};

export function useVisionAnalysis(): UseVisionAnalysisReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [metrics, setMetrics] = useState<VisionMetrics>(DEFAULT_METRICS);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Load face-api.js models once
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
        console.error("Failed to load face-api models:", err);
        setError("Failed to load vision models");
      }
    };

    loadModels();
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

      // Find dominant emotion
      const emotionEntries = Object.entries(expressions);
      const dominant = emotionEntries.reduce((max, curr) =>
        curr[1] > max[1] ? curr : max
      );

      // Confidence score: higher when happy/neutral, lower when fearful/sad/angry
      const positiveScore =
        (expressions.happy + expressions.neutral + expressions.surprised) * 100;
      const confidence = Math.round(Math.min(positiveScore, 100));

      // Stress level: higher when fearful, angry, sad
      const stressScore =
        (expressions.fearful + expressions.angry + expressions.sad + expressions.disgusted) * 100;
      const stressLevel = Math.round(Math.min(stressScore, 100));

      // Eye contact estimate: distance between eye landmarks and face center
      // Simple heuristic — symmetric eyes pointing forward = good eye contact
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const nose = landmarks.getNose();

      const eyesMidX = (leftEye[0].x + rightEye[3].x) / 2;
      const noseX = nose[3].x;
      const offset = Math.abs(eyesMidX - noseX);
      const faceWidth = Math.abs(rightEye[3].x - leftEye[0].x);
      const eyeContactScore = Math.max(0, 100 - (offset / faceWidth) * 200);

      setMetrics({
        confidence,
        emotion: dominant[0],
        eyeContact: Math.round(eyeContactScore),
        faceDetected: true,
        stressLevel,
      });
    } catch (err) {
      console.error("Analysis error:", err);
    }
  }, [modelsLoaded]);

  const start = useCallback(async () => {
    if (!modelsLoaded) {
      setError("Models not loaded yet, please wait...");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsReady(true);
      setError(null);

      // Analyze every 500ms
      intervalRef.current = setInterval(analyze, 500);
    } catch (err) {
      setError("Camera access denied");
      console.error(err);
    }
  }, [modelsLoaded, analyze]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
    setMetrics(DEFAULT_METRICS);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { videoRef, metrics, isReady, error, start, stop };
}