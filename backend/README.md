---
title: AI Interview Coach API
emoji: 🎙️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
---
# AI Interview Coach — Backend API

Multi-agent AI system for interview practice. FastAPI + LangGraph + Gemini + Groq Whisper.

🔗 **Frontend:** [Live Demo](https://your-app.vercel.app)
💻 **Source:** [GitHub](https://github.com/Achyuth/ai-interview-coach)

## Architecture

- **Interviewer Agent**: Gemini 2.0 Flash
- **Transcription**: Groq Whisper Large v3
- **Evaluator Agent**: Llama 3.3 70B via Groq
- **Coach Agent**: Gemini 2.0 Flash
- **Orchestration**: LangGraph
- **Database**: Supabase Postgres

Built by [Achyuth](https://linkedin.com/in/your-handle)