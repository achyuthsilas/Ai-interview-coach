"""
Supabase database wrapper.
Handles all reads/writes for interview sessions, messages, evaluations, and reports.
"""

import os
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


class Database:
    """Lightweight wrapper around Supabase for our app."""

    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")

        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

        self.client: Client = create_client(url, key)

    # ==================== SESSIONS ====================

    def create_session(self, setup_data: Dict[str, Any]) -> str:
        """Create a new interview session and return its ID."""
        result = (
            self.client.table("interview_sessions")
            .insert({
                "user_id": setup_data.get("user_id", "anonymous"),
                "company": setup_data["company"],
                "job_description": setup_data["job_description"],
                "resume": setup_data["resume"],
                "interview_type": setup_data["interview_type"],
                "persona": setup_data["persona"],
            })
            .execute()
        )
        return result.data[0]["id"]

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a session by ID."""
        result = (
            self.client.table("interview_sessions")
            .select("*")
            .eq("id", session_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def complete_session(self, session_id: str):
        """Mark session as completed."""
        self.client.table("interview_sessions").update({
            "status": "completed",
            "completed_at": "now()",
        }).eq("id", session_id).execute()

    # ==================== MESSAGES ====================

    def add_message(self, session_id: str, role: str, content: str, question_number: Optional[int] = None):
        """Save a message in the conversation."""
        self.client.table("interview_messages").insert({
            "session_id": session_id,
            "role": role,
            "content": content,
            "question_number": question_number,
        }).execute()

    def get_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all messages for a session, in order."""
        result = (
            self.client.table("interview_messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        return result.data

    # ==================== EVALUATIONS ====================

    def save_evaluation(self, session_id: str, evaluation: Dict[str, Any]):
        """Save an answer evaluation from the Evaluator agent."""
        self.client.table("answer_evaluations").insert({
            "session_id": session_id,
            **evaluation,
        }).execute()

    def get_evaluations(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all evaluations for a session."""
        result = (
            self.client.table("answer_evaluations")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        return result.data

    # ==================== REPORTS ====================

    def save_report(self, session_id: str, report: Dict[str, Any]):
        """Save the final coaching report."""
        self.client.table("coaching_reports").insert({
            "session_id": session_id,
            **report,
        }).execute()

    def get_report(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get the final report for a session."""
        result = (
            self.client.table("coaching_reports")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return result.data[0] if result.data else None

    # ==================== USER MEMORY ====================

    def add_pattern(self, user_id: str, pattern_type: str, description: str):
        """Track a recurring pattern for a user."""
        # Check if pattern exists
        existing = (
            self.client.table("user_memory")
            .select("*")
            .eq("user_id", user_id)
            .eq("pattern_type", pattern_type)
            .eq("description", description)
            .execute()
        )

        if existing.data:
            # Increment count
            row = existing.data[0]
            self.client.table("user_memory").update({
                "occurrences": row["occurrences"] + 1,
                "last_seen": "now()",
            }).eq("id", row["id"]).execute()
        else:
            # Create new pattern
            self.client.table("user_memory").insert({
                "user_id": user_id,
                "pattern_type": pattern_type,
                "description": description,
            }).execute()

    def get_user_patterns(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve patterns for a user, most frequent first."""
        result = (
            self.client.table("user_memory")
            .select("*")
            .eq("user_id", user_id)
            .order("occurrences", desc=True)
            .limit(10)
            .execute()
        )
        return result.data
    
    # ==================== SESSION METRICS ====================

    def save_metrics(self, session_id: str, metrics: Dict[str, Any]):
        """Save aggregated vision + voice metrics for a session."""
        # Upsert: insert or update if exists
        existing = (
            self.client.table("session_metrics")
            .select("id")
            .eq("session_id", session_id)
            .execute()
        )
        
        if existing.data:
            self.client.table("session_metrics").update(metrics).eq(
                "session_id", session_id
            ).execute()
        else:
            self.client.table("session_metrics").insert({
                "session_id": session_id,
                **metrics,
            }).execute()

    def get_metrics(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get metrics for a session."""
        result = (
            self.client.table("session_metrics")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return result.data[0] if result.data else None


# Singleton instance — import this everywhere
db = Database()