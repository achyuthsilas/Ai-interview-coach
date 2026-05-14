from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field


class InterviewType(str, Enum):
    """Different types of interviews users can practice."""
    SCREENING = "screening"
    BEHAVIORAL = "behavioral"
    TECHNICAL_CODING = "technical_coding"
    SYSTEM_DESIGN = "system_design"
    HR = "hr"


class InterviewerPersona(str, Enum):
    """Different interviewer personalities."""
    FRIENDLY = "friendly"
    NEUTRAL = "neutral"
    ADVERSARIAL = "adversarial"


class InterviewSetup(BaseModel):
    """Data sent when starting a new interview."""
    job_description: str = Field(..., min_length=20, max_length=10000)
    company: str = Field(..., min_length=1, max_length=200)
    resume: str = Field(..., min_length=20, max_length=20000)
    interview_type: InterviewType
    persona: InterviewerPersona = InterviewerPersona.NEUTRAL


class Message(BaseModel):
    """A single message in the conversation."""
    role: str  # "interviewer" or "candidate"
    content: str


class InterviewTurn(BaseModel):
    """User submits their answer; we return next question."""
    session_id: str
    answer: str


class InterviewResponse(BaseModel):
    """What we send back after each turn."""
    session_id: str
    interviewer_message: str
    question_number: int
    is_complete: bool



# ============================================================
# Phase 3 additions
# ============================================================

class FinalReport(BaseModel):
    """The final coaching report at end of interview."""
    overall_score: int
    summary: str
    top_strengths: str
    top_weaknesses: str
    action_items: str
    recurring_patterns: str


class InterviewResponseV2(BaseModel):
    """Enhanced response that may include final report."""
    session_id: str
    interviewer_message: str
    question_number: int
    is_complete: bool
    final_report: Optional[FinalReport] = None

# ============================================================
# Phase 4.5: Vision + Voice Metrics
# ============================================================

class SessionMetrics(BaseModel):
    """Aggregated metrics from one interview session."""
    session_id: str
    avg_confidence: int
    avg_eye_contact: int
    avg_stress: int
    dominant_emotion: str
    total_filler_words: int
    filler_word_breakdown: dict
    avg_volume: int
    speaking_time_seconds: int
    silent_time_seconds: int