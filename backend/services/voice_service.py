"""
Voice service - high-accuracy speech-to-text via Groq Whisper Large v3.
"""

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


# Common technical / interview vocabulary to bias Whisper toward
# (Whisper accepts a "prompt" parameter to nudge it toward expected words)
INTERVIEW_VOCABULARY = (
    "Technical interview context. The candidate may discuss: "
    "Python, JavaScript, TypeScript, React, Next.js, Node.js, FastAPI, "
    "Kubernetes, Docker, AWS, GCP, Azure, microservices, REST API, "
    "GraphQL, PostgreSQL, MongoDB, Redis, Kafka, RabbitMQ, "
    "machine learning, NLP, LLM, embeddings, transformers, neural networks, "
    "deep learning, TensorFlow, PyTorch, LangChain, LangGraph, RAG, "
    "system design, scalability, latency, throughput, load balancing, "
    "CI/CD, DevOps, Git, GitHub, agile, scrum, sprint, "
    "data structures, algorithms, Big O, time complexity, "
    "OAuth, JWT, authentication, authorization, encryption, "
    "STAR method, leadership, team collaboration, conflict resolution, "
    "stakeholders, deliverables, KPIs, OKRs, ROI."
)


class VoiceService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        custom_prompt: str = "",
    ) -> dict:
        """
        Transcribe audio using Groq's Whisper Large v3.
        Returns: {"text": "...", "language": "en", "duration": 5.2}
        """
        try:
            # Combine default vocabulary with any session-specific terms
            prompt = INTERVIEW_VOCABULARY
            if custom_prompt:
                prompt = f"{prompt} Specific context: {custom_prompt}"

            # Whisper has a 224 token limit on prompts, so trim if needed
            if len(prompt) > 800:
                prompt = prompt[:800]

            transcription = self.client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3-turbo",  # ~2x faster, same accuracy
                response_format="verbose_json",
                language="en",
                prompt=prompt,
                temperature=0.0,
            )

            return {
                "text": transcription.text.strip(),
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