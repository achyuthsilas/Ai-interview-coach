"""
Voice service - handles speech-to-text fallback via Groq Whisper.
Groq's Whisper Large v3 is FREE with generous rate limits.
"""

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


class VoiceService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> dict:
        """
        Transcribe audio using Groq's Whisper Large v3.
        Returns: {"text": "...", "language": "en", "duration": 5.2}
        """
        try:
            transcription = self.client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3",
                response_format="verbose_json",
                language="en",  # Set to None for auto-detect
            )

            return {
                "text": transcription.text,
                "language": getattr(transcription, "language", "en"),
                "duration": getattr(transcription, "duration", 0.0),
                "success": True,
            }
        except Exception as e:
            print(f"⚠️ Whisper transcription failed: {e}")
            return {
                "text": "",
                "language": "en",
                "duration": 0.0,
                "success": False,
                "error": str(e),
            }


voice_service = VoiceService()