"""
Multi-Agent Orchestrator.
Runs Evaluator and Interviewer IN PARALLEL for faster response times.
"""

import asyncio
from typing import TypedDict, List, Dict, Optional
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


class InterviewOrchestrator:
    """
    Runs Interviewer + Evaluator IN PARALLEL (instead of sequentially).
    This roughly halves response time per turn.
    """

    def __init__(self, interviewer: InterviewerAgent):
        self.interviewer = interviewer
        self.evaluator = EvaluatorAgent()
        self.coach = CoachAgent()
        # Thread pool for running blocking LLM calls in parallel
        self.executor = ThreadPoolExecutor(max_workers=3)

    def run_turn(
        self,
        session_id: str,
        setup: Dict,
        last_question: str,
        last_answer: str,
        existing_evaluations: List[Dict],
    ) -> InterviewState:
        """Execute one turn with parallel agent calls."""

        evaluations = existing_evaluations.copy()

        # 🚀 Submit BOTH agent calls in parallel
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

        # Wait for both to complete (they ran in parallel!)
        new_evaluation = evaluator_future.result()
        next_message, is_complete = interviewer_future.result()

        evaluations.append(new_evaluation)

        # If interview is done, also run the coach
        final_report = None
        if is_complete:
            final_report = self.coach.generate_report(
                company=setup["company"],
                job_description=setup["job_description"],
                interview_type=setup["interview_type"],
                evaluations=evaluations,
                past_patterns=[],
            )

        return {
            "session_id": session_id,
            "setup": setup,
            "last_question": last_question,
            "last_answer": last_answer,
            "evaluations": evaluations,
            "next_message": next_message,
            "is_complete": is_complete,
            "final_report": final_report,
        }