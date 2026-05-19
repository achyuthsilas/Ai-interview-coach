"""
Multi-Agent Orchestrator.
Runs Evaluator and Interviewer IN PARALLEL for faster response times.
Non-final turns: return after interviewer finishes; evaluator runs in background.
Final turn: wait for evaluator (needed for coach report), then run coach.
"""

from typing import TypedDict, List, Dict, Optional, Any
from concurrent.futures import ThreadPoolExecutor

from agents.interviewer import InterviewerAgent
from agents.evaluator import EvaluatorAgent
from agents.coach import CoachAgent


class InterviewState(TypedDict):
    session_id: str
    setup: Dict
    last_question: str
    last_answer: str
    evaluations: List[Dict]
    next_message: str
    is_complete: bool
    final_report: Optional[Dict]
    _evaluator_future: Optional[Any]  # set on non-final turns; None on final


class InterviewOrchestrator:
    """
    Runs Interviewer + Evaluator concurrently.
    For non-final turns the response is returned as soon as the interviewer
    finishes; the evaluator keeps running in the background so it doesn't
    add to perceived latency.
    """

    def __init__(self, interviewer: InterviewerAgent):
        self.interviewer = interviewer
        self.evaluator = EvaluatorAgent()
        self.coach = CoachAgent()
        self.evaluations: List[Dict] = []  # in-memory cache; synced to DB in background
        self.executor = ThreadPoolExecutor(max_workers=3)

    def run_turn(
        self,
        session_id: str,
        setup: Dict,
        last_question: str,
        last_answer: str,
    ) -> InterviewState:
        """Execute one turn.  Blocks only on the interviewer for non-final turns."""

        # Submit both agents concurrently
        evaluator_future = self.executor.submit(
            self.evaluator.evaluate,
            question=last_question,
            answer=last_answer,
            company=setup["company"],
            job_description=setup["job_description"],
            interview_type=setup["interview_type"],
        )

        interviewer_future = self.executor.submit(
            self.interviewer.respond_to_answer,
            last_answer,
        )

        # Block ONLY on the interviewer — this is what the user waits for
        next_message, is_complete = interviewer_future.result()

        if is_complete:
            # Final turn: evaluator output is needed for the coaching report
            new_evaluation = evaluator_future.result()
            self.evaluations.append(new_evaluation)
            final_report = self.coach.generate_report(
                company=setup["company"],
                job_description=setup["job_description"],
                interview_type=setup["interview_type"],
                evaluations=self.evaluations,
                past_patterns=[],
            )
            return {
                "session_id": session_id,
                "setup": setup,
                "last_question": last_question,
                "last_answer": last_answer,
                "evaluations": list(self.evaluations),
                "next_message": next_message,
                "is_complete": True,
                "final_report": final_report,
                "_evaluator_future": None,
            }

        # Non-final turn: return immediately; evaluator finishes in background
        return {
            "session_id": session_id,
            "setup": setup,
            "last_question": last_question,
            "last_answer": last_answer,
            "evaluations": list(self.evaluations),  # new eval not yet appended
            "next_message": next_message,
            "is_complete": False,
            "final_report": None,
            "_evaluator_future": evaluator_future,
        }
