"use client";

import { VisionMetrics } from "@/hooks/useVisionAnalysis";
import { VoiceMetrics } from "@/hooks/useVoiceAnalysis";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  visionMetrics: VisionMetrics;
  voiceMetrics: VoiceMetrics;
  fillerWordCount: number;
  isReady: boolean;
}

export function WebcamPanel({
  videoRef,
  visionMetrics,
  voiceMetrics,
  fillerWordCount,
  isReady,
}: Props) {
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden">
      {/* Video feed */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            Loading camera...
          </div>
        )}

        {/* Live overlay */}
        {isReady && visionMetrics.faceDetected && (
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs">
            <span className="text-green-400">●</span> Live • {visionMetrics.emotion}
          </div>
        )}

        {voiceMetrics.isSpeaking && (
          <div className="absolute bottom-2 right-2 bg-blue-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs">
            🎙️ Speaking
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="p-4 space-y-3">
        <Metric label="Confidence" value={visionMetrics.confidence} color="green" />
        <Metric label="Eye Contact" value={visionMetrics.eyeContact} color="blue" />
        <Metric label="Stress Level" value={visionMetrics.stressLevel} color="red" inverse />
        <Metric label="Voice Volume" value={voiceMetrics.volume} color="purple" />

        <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-700">
          <span>Filler words: <strong className="text-white">{fillerWordCount}</strong></span>
          <span>Pace: <strong className="text-white">{voiceMetrics.pace}</strong></span>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
  inverse,
}: {
  label: string;
  value: number;
  color: "green" | "blue" | "red" | "purple";
  inverse?: boolean;
}) {
  const colorMap = {
    green: "from-green-500 to-emerald-400",
    blue: "from-blue-500 to-cyan-400",
    red: "from-red-500 to-orange-400",
    purple: "from-purple-500 to-pink-400",
  };

  // For inverse metrics (like stress), high is bad
  const displayValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-semibold">{displayValue}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colorMap[color]} transition-all duration-500`}
          style={{ width: `${displayValue}%` }}
        />
      </div>
    </div>
  );
}