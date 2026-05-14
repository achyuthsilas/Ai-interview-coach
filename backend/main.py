"""
AI Interview Coach - Main API server.
Phase 3: Multi-agent orchestration with persistence.
"""

import os
from typing import Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

from agents.interviewer import InterviewerAgent
from agents.orchestrator import InterviewOrchestrator
from database.supabase_client import db
from fastapi import File, UploadFile
from services.voice_service import voice_service
from pypdf import PdfReader
import io

from models.schemas import (
    InterviewSetup,
    InterviewTurn,
    InterviewResponseV2,
    FinalReport,
    Message,
    InterviewType,
    InterviewerPersona,
)

load_dotenv()

# ============================================================
# APP SETUP
# ============================================================

app = FastAPI(title="AI Interview Coach API", version="0.6.0")

# ============================================================
# RATE LIMITING — protect against abuse
# ============================================================
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allowed origins — local dev + production frontend
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add production frontend URL from env var (set on Fly.io)
production_frontend = os.getenv("FRONTEND_URL")
if production_frontend:
    ALLOWED_ORIGINS.append(production_frontend)

# Allow Vercel preview deployments (e.g., your-app-git-branch.vercel.app)
# Pattern match for any subdomain of vercel.app
import re
ALLOWED_ORIGIN_REGEX = r"https://.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache of active orchestrators (one per session).
active_orchestrators: Dict[str, InterviewOrchestrator] = {}


def _rebuild_orchestrator(session_id: str) -> InterviewOrchestrator:
    """Reconstruct an orchestrator from DB after a server restart."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found. It may have expired — start a new interview.",
        )

    setup = InterviewSetup(
        company=session["company"],
        job_description=session["job_description"],
        resume=session["resume"],
        interview_type=InterviewType(session["interview_type"]),
        persona=InterviewerPersona(session["persona"]),
    )

    interviewer = InterviewerAgent(setup)

    db_messages = db.get_messages(session_id)
    for msg in db_messages:
        interviewer.history.append(Message(role=msg["role"], content=msg["content"]))

    # question_count = number of interviewer turns (opening counts as 1)
    interviewer.question_count = sum(1 for m in db_messages if m["role"] == "interviewer")

    orchestrator = InterviewOrchestrator(interviewer)
    active_orchestrators[session_id] = orchestrator
    return orchestrator


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
@limiter.limit("10/hour")  # ← ADD THIS
def start_interview(request: Request, setup: InterviewSetup):  # ← ADD `request: Request`
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
@limiter.limit("60/hour")  # ← ADD THIS
def respond_to_interview(request: Request, turn: InterviewTurn):  # ← ADD `request: Request`
    """Submit an answer; multi-agent flow runs in the background."""
    if turn.session_id not in active_orchestrators:
        orchestrator = _rebuild_orchestrator(turn.session_id)
    else:
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
@limiter.limit("100/hour")  # ← ADD THIS
async def transcribe_audio(
    request: Request,  # ← ADD THIS as the FIRST parameter
    file: UploadFile = File(...),
    session_id: str = "",
):
    """
    High-accuracy transcription via Groq Whisper Large v3.
    Uses session context (JD, resume) to bias toward likely terminology.
    """
    audio_bytes = await file.read()

    # Build custom prompt from session if available
    custom_prompt = ""
    if session_id:
        try:
            session = db.get_session(session_id)
            if session:
                # Use first 300 chars of JD as context for Whisper
                jd_snippet = session.get("job_description", "")[:300]
                custom_prompt = f"Job: {jd_snippet}"
        except Exception:
            pass

    result = voice_service.transcribe(
        audio_bytes,
        filename=file.filename or "audio.webm",
        custom_prompt=custom_prompt,
    )
    return result

@app.post("/api/resume/parse")
@limiter.limit("20/hour")  # ← ADD THIS
async def parse_resume(request: Request, file: UploadFile = File(...)):  # ← ADD `request: Request`
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
    

# ============================================================
# PRODUCTION SERVER ENTRY
# ============================================================

if __name__ == "__main__":
    import uvicorn
    # Use PORT env var (Fly.io sets this to 8080)
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        # No --reload in production
    )