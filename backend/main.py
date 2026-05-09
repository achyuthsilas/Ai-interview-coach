"""
AI Interview Coach - Main API server.
"""

import os
import uuid
from typing import Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from agents.interviewer import InterviewerAgent
from models.schemas import (
    InterviewSetup,
    InterviewTurn,
    InterviewResponse,
)

# Load environment variables (.env file)
load_dotenv()

# ============================================================
# APP SETUP
# ============================================================

app = FastAPI(title="AI Interview Coach API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# IN-MEMORY SESSION STORE
# (We'll move this to a real database in Phase 3)
# ============================================================

active_sessions: Dict[str, InterviewerAgent] = {}


# ============================================================
# HEALTH ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "AI Interview Coach API is running",
        "version": "0.2.0",
    }


@app.get("/api/hello")
def hello():
    return {"message": "Hello from your Python backend!"}


@app.get("/api/check-keys")
def check_keys():
    """Quick way to verify API keys are loaded (does NOT expose them)."""
    return {
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
    }


# ============================================================
# INTERVIEW ENDPOINTS
# ============================================================

@app.post("/api/interview/start", response_model=InterviewResponse)
def start_interview(setup: InterviewSetup):
    """Begins a new interview session."""
    try:
        # Create new agent
        agent = InterviewerAgent(setup)
        opening_message = agent.start_interview()

        # Store the session
        session_id = str(uuid.uuid4())
        active_sessions[session_id] = agent

        return InterviewResponse(
            session_id=session_id,
            interviewer_message=opening_message,
            question_number=1,
            is_complete=False,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start: {str(e)}")


@app.post("/api/interview/respond", response_model=InterviewResponse)
def respond_to_interview(turn: InterviewTurn):
    """Submit an answer and get the next question."""
    if turn.session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    agent = active_sessions[turn.session_id]

    try:
        next_message, is_complete = agent.respond_to_answer(turn.answer)

        return InterviewResponse(
            session_id=turn.session_id,
            interviewer_message=next_message,
            question_number=agent.question_count,
            is_complete=is_complete,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.delete("/api/interview/{session_id}")
def end_interview(session_id: str):
    """Manually end and clean up a session."""
    if session_id in active_sessions:
        del active_sessions[session_id]
        return {"message": "Session ended"}
    raise HTTPException(status_code=404, detail="Session not found")