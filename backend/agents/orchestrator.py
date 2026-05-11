"""
Multi-Agent Orchestrator.
Coordinates Interviewer, Evaluator, and Coach agents using LangGraph.
"""

from typing import TypedDict, List, Dict, Optional
from langgraph.graph import StateGraph, END

from agents.interviewer import InterviewerAgent
from agents.evaluator import EvaluatorAgent
from agents.coach import CoachAgent


# ============================================================
# SHARED STATE — Data that flows between agents
# ============================================================

class InterviewState(TypedDict):
    """The shared state passed between agents in the graph."""
    session_id: str
    setup: Dict  # Original setup data
    last_question: str
    last_answer: str
    evaluations: List[Dict]
    next_message: str
    is_complete: bool
    final_report: Optional[Dict]


# ============================================================
# THE ORCHESTRATOR
# ============================================================

class InterviewOrchestrator:
    """
    Runs the multi-agent flow:
    1. Candidate submits answer
    2. Evaluator scores it (silent, parallel-able)
    3. Interviewer generates next question
    4. If interview complete → Coach generates final report
    """

    def __init__(self, interviewer: InterviewerAgent):
        self.interviewer = interviewer
        self.evaluator = EvaluatorAgent()
        self.coach = CoachAgent()

    # ==================== AGENT NODES ====================

    def evaluator_node(self, state: InterviewState) -> InterviewState:
        """Run the evaluator on the candidate's last answer."""
        if not state["last_answer"]:
            return state

        evaluation = self.evaluator.evaluate(
            question=state["last_question"],
            answer=state["last_answer"],
            company=state["setup"]["company"],
            job_description=state["setup"]["job_description"],
            interview_type=state["setup"]["interview_type"],
        )

        state["evaluations"].append(evaluation)
        return state

    def interviewer_node(self, state: InterviewState) -> InterviewState:
        """Run the interviewer to generate the next question."""
        next_message, is_complete = self.interviewer.respond_to_answer(
            state["last_answer"]
        )
        state["next_message"] = next_message
        state["is_complete"] = is_complete

        # Track the new question (asked next)
        if not is_complete:
            state["last_question"] = next_message

        return state

    def coach_node(self, state: InterviewState) -> InterviewState:
        """Run the coach to generate the final report."""
        report = self.coach.generate_report(
            company=state["setup"]["company"],
            job_description=state["setup"]["job_description"],
            interview_type=state["setup"]["interview_type"],
            evaluations=state["evaluations"],
            past_patterns=[],  # Pass real patterns from db here later
        )
        state["final_report"] = report
        return state

    # ==================== ROUTING LOGIC ====================

    def should_run_coach(self, state: InterviewState) -> str:
        """If interview is done, run the coach. Otherwise, end the turn."""
        if state["is_complete"]:
            return "coach"
        return END

    # ==================== BUILD THE GRAPH ====================

    def build_graph(self):
        """Wire the agents together."""
        graph = StateGraph(InterviewState)

        # Add the agent nodes
        graph.add_node("evaluator", self.evaluator_node)
        graph.add_node("interviewer", self.interviewer_node)
        graph.add_node("coach", self.coach_node)

        # Define the flow
        graph.set_entry_point("evaluator")
        graph.add_edge("evaluator", "interviewer")
        graph.add_conditional_edges(
            "interviewer",
            self.should_run_coach,
            {"coach": "coach", END: END},
        )
        graph.add_edge("coach", END)

        return graph.compile()

    # ==================== PUBLIC API ====================

    def run_turn(
        self,
        session_id: str,
        setup: Dict,
        last_question: str,
        last_answer: str,
        existing_evaluations: List[Dict],
    ) -> InterviewState:
        """Execute one turn of the multi-agent flow."""
        graph = self.build_graph()

        initial_state: InterviewState = {
            "session_id": session_id,
            "setup": setup,
            "last_question": last_question,
            "last_answer": last_answer,
            "evaluations": existing_evaluations.copy(),
            "next_message": "",
            "is_complete": False,
            "final_report": None,
        }

        return graph.invoke(initial_state)