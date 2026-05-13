"""
AI Interview Coach - Main API server.
Phase 3: Multi-agent orchestration with persistence.
"""

import os
from typing import Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from agents.interviewer import InterviewerAgent
from agents.orchestrator import InterviewOrchestrator
from database.supabase_client import db
from fastapi import File, UploadFile
from services.voice_service import voice_service
from models.schemas import SessionMetrics
from pypdf import PdfReader
import io

from models.schemas import (
    InterviewSetup,
    InterviewTurn,
    InterviewResponseV2,
    FinalReport,
)

load_dotenv()

# ============================================================
# APP SETUP
# ============================================================

app = FastAPI(title="AI Interview Coach API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache of active orchestrators (one per session).
# The full conversation is in the DB; this just holds the live agents.
active_orchestrators: Dict[str, InterviewOrchestrator] = {}


# ============================================================
# HEALTH ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "AI Interview Coach API is running",
        "version": "0.3.0",
    }


@app.get("/api/check-keys")
def check_keys():
    return {
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "supabase_configured": bool(os.getenv("SUPABASE_URL")),
    }


# ============================================================
# INTERVIEW ENDPOINTS
# ============================================================

@app.post("/api/interview/start", response_model=InterviewResponseV2)
def start_interview(setup: InterviewSetup):
    """Begins a new interview, persisting it to the DB."""
    try:
        # Create session in database
        session_id = db.create_session({
            "user_id": "anonymous",  # Will be real user ID after auth in Phase 5
            "company": setup.company,
            "job_description": setup.job_description,
            "resume": setup.resume,
            "interview_type": setup.interview_type.value,
            "persona": setup.persona.value,
        })

        # Create the interviewer agent + orchestrator
        interviewer = InterviewerAgent(setup)
        opening_message = interviewer.start_interview()

        orchestrator = InterviewOrchestrator(interviewer)
        active_orchestrators[session_id] = orchestrator

        # Save the opening message
        db.add_message(session_id, "interviewer", opening_message, question_number=1)

        return InterviewResponseV2(
            session_id=session_id,
            interviewer_message=opening_message,
            question_number=1,
            is_complete=False,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start: {str(e)}")


@app.post("/api/interview/respond", response_model=InterviewResponseV2)
def respond_to_interview(turn: InterviewTurn):
    """Submit an answer; multi-agent flow runs in the background."""
    if turn.session_id not in active_orchestrators:
        raise HTTPException(
            status_code=404,
            detail="Session not found. It may have expired — start a new interview.",
        )

    orchestrator = active_orchestrators[turn.session_id]
    interviewer = orchestrator.interviewer

    try:
        # Get the last question (what the interviewer just asked)
        last_question = interviewer.history[-1].content if interviewer.history else ""

        # Get full session context for the orchestrator
        session = db.get_session(turn.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not in database")

        existing_evals = db.get_evaluations(turn.session_id)

        # Save the candidate's answer
        db.add_message(
            turn.session_id,
            "candidate",
            turn.answer,
            question_number=interviewer.question_count,
        )

        # 🚀 Run the multi-agent flow
        final_state = orchestrator.run_turn(
            session_id=turn.session_id,
            setup={
                "company": session["company"],
                "job_description": session["job_description"],
                "interview_type": session["interview_type"],
            },
            last_question=last_question,
            last_answer=turn.answer,
            existing_evaluations=existing_evals,
        )

        # Save the new evaluation (the latest one)
        if final_state["evaluations"] and len(final_state["evaluations"]) > len(existing_evals):
            new_eval = final_state["evaluations"][-1]
            db.save_evaluation(turn.session_id, new_eval)

        # Save the new interviewer message
        db.add_message(
            turn.session_id,
            "interviewer",
            final_state["next_message"],
            question_number=interviewer.question_count,
        )

        # If complete, save the final report
        final_report_obj = None
        if final_state["is_complete"] and final_state["final_report"]:
            db.save_report(turn.session_id, final_state["final_report"])
            db.complete_session(turn.session_id)
            final_report_obj = FinalReport(**final_state["final_report"])

            # Clean up the in-memory orchestrator
            del active_orchestrators[turn.session_id]

        return InterviewResponseV2(
            session_id=turn.session_id,
            interviewer_message=final_state["next_message"],
            question_number=interviewer.question_count,
            is_complete=final_state["is_complete"],
            final_report=final_report_obj,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/interview/{session_id}/report")
def get_report(session_id: str):
    """Fetch the final report for a completed session."""
    report = db.get_report(session_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    evaluations = db.get_evaluations(session_id)
    messages = db.get_messages(session_id)
    metrics = db.get_metrics(session_id)

    return {
        "report": report,
        "evaluations": evaluations,
        "messages": messages,
        "metrics": metrics,
    }


@app.get("/api/sessions")
def list_sessions(user_id: str = "anonymous"):
    """List recent sessions for a user."""
    result = (
        db.client.table("interview_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return result.data

@app.post("/api/voice/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Fallback transcription via Groq Whisper.
    Used when browser's Web Speech API isn't available or fails.
    """
    audio_bytes = await file.read()
    result = voice_service.transcribe(audio_bytes, filename=file.filename or "audio.webm")
    return result

@app.post("/api/resume/parse")
async def parse_resume(file: UploadFile = File(...)):
    """Extract text from an uploaded PDF resume."""
    try:
        contents = await file.read()
        
        if file.filename and file.filename.lower().endswith(".pdf"):
            pdf = PdfReader(io.BytesIO(contents))
            text = ""
            for page in pdf.pages:
                text += page.extract_text() + "\n"
            return {"success": True, "text": text.strip()}
        else:
            # Treat as plain text
            text = contents.decode("utf-8", errors="ignore")
            return {"success": True, "text": text.strip()}
    except Exception as e:
        return {"success": False, "error": str(e), "text": ""}
    

@app.post("/api/interview/{session_id}/metrics")
async def save_session_metrics(session_id: str, metrics: dict):
    """Save aggregated metrics from vision + voice analysis."""
    try:
        db.save_metrics(session_id, metrics)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))