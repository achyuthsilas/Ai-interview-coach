"use client";

import { useState, useEffect, useCallback } from "react";

interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string, onEnd?: () => void) => void;
  cancel: () => void;
  voices: SpeechSynthesisVoice[];
}

// Priority order — best to worst free voices typically available
// "Natural" voices = newest Microsoft Edge neural voices (very realistic!)
const VOICE_PRIORITY = [
  // Microsoft Edge "Natural" voices (almost human-quality, free on Edge/Chrome)
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Microsoft Guy Online (Natural)",
  "Microsoft Davis Online (Natural)",
  "Microsoft Tony Online (Natural)",
  // Google Chrome's better voices
  "Google US English",
  "Google UK English Female",
  "Google UK English Male",
  // Apple/Mac neural voices
  "Samantha",
  "Alex",
  "Daniel",
];

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        // Log available voices to console so you can see what you have
        console.log(
          "Available voices:",
          availableVoices.map((v) => `${v.name} (${v.lang})`)
        );
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const pickBestVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    // Try priority list first
    for (const name of VOICE_PRIORITY) {
      const match = voices.find((v) => v.name === name);
      if (match) return match;
    }

    // Fallback: any "Natural" voice
    const natural = voices.find(
      (v) => v.name.toLowerCase().includes("natural") && v.lang.startsWith("en")
    );
    if (natural) return natural;

    // Fallback: any "Google" voice
    const google = voices.find(
      (v) => v.name.toLowerCase().includes("google") && v.lang.startsWith("en")
    );
    if (google) return google;

    // Fallback: any English voice
    return voices.find((v) => v.lang.startsWith("en")) || voices[0];
  }, [voices]);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!isSupported) {
        onEnd?.();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickBestVoice();
      if (voice) {
        utterance.voice = voice;
        console.log("Using voice:", voice.name);
      }

      // More natural delivery
      utterance.rate = 0.95;  // Slightly slower than default = more natural
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, pickBestVoice]
  );

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { isSupported, isSpeaking, speak, cancel, voices };
}