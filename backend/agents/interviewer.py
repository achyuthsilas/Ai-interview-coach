"""
Interviewer Agent - The AI that conducts the interview.
Uses Google's Gemini model to generate contextual questions.
"""

import os
from typing import List
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from models.schemas import (
    InterviewSetup,
    InterviewType,
    InterviewerPersona,
    Message,
)

# Load environment variables from .env file
load_dotenv()


# ============================================================
# PERSONA PROMPTS — How each interviewer "personality" behaves
# ============================================================

PERSONA_INSTRUCTIONS = {
    InterviewerPersona.FRIENDLY: """
You are warm, encouraging, and supportive. You make the candidate feel
comfortable. You acknowledge good answers positively before moving on.
""",
    InterviewerPersona.NEUTRAL: """
You are professional, balanced, and unbiased. You neither overly praise
nor criticize. You ask questions clearly and concisely.
""",
    InterviewerPersona.ADVERSARIAL: """
You are tough, skeptical, and challenging. You push back on weak answers,
ask probing follow-ups, and play devil's advocate. You don't accept vague
answers—you demand specifics. Stay professional but firm.
""",
}


# ============================================================
# INTERVIEW TYPE PROMPTS — Style of questions for each type
# ============================================================

INTERVIEW_TYPE_INSTRUCTIONS = {
    InterviewType.SCREENING: """
This is an initial screening interview (15-20 min in real life).
Focus on:
- Confirming the candidate's basic background and motivation
- Why this company / why this role
- High-level fit for the position
- Salary expectations and availability
Ask 5 short questions.
""",
    InterviewType.BEHAVIORAL: """
This is a behavioral interview using the STAR method.
Focus on:
- Past experiences that demonstrate skills relevant to the JD
- Conflict resolution, leadership, failures, achievements
- Probe for Situation, Task, Action, Result in their answers
Ask 5 questions, each digging into a different competency.
""",
    InterviewType.TECHNICAL_CODING: """
This is a technical coding interview.
Focus on:
- Data structures and algorithms relevant to the role
- Problem-solving approach (ask them to think out loud)
- Code complexity analysis
- Start with a warmup, then 1-2 medium problems
Ask 3 questions; let them explain solutions in plain language.
""",
    InterviewType.SYSTEM_DESIGN: """
This is a system design interview.
Focus on:
- Designing scalable systems based on requirements
- Trade-offs (consistency vs availability, SQL vs NoSQL, etc.)
- Capacity estimation, bottlenecks, monitoring
Ask 3 questions, each exploring a different architectural area.
""",
    InterviewType.HR: """
This is an HR / culture-fit interview.
Focus on:
- Career goals and aspirations
- Work style and team dynamics
- Reasons for leaving current role
- Cultural alignment with the company
Ask 5 questions.
""",
}


# ============================================================
# THE INTERVIEWER AGENT CLASS
# ============================================================

class InterviewerAgent:
    """
    The AI interviewer. Holds the conversation state and generates
    the next question based on the candidate's previous answers.
    """

    # Total questions per interview (we'll keep it short for the MVP)
    TOTAL_QUESTIONS = 5

    def __init__(self, setup: InterviewSetup):
        self.setup = setup
        self.history: List[Message] = []
        self.question_count = 0

        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            groq_api_key=os.getenv("GROQ_API_KEY"),
        )
        self._fallback_llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.7,
            google_api_key=os.getenv("GEMINI_API_KEY"),
        )

    def _invoke(self, messages):
        """Invoke Groq primary; fall back to Gemini on any error."""
        try:
            return self.llm.invoke(messages)
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower() or "quota" in str(e).lower():
                return self._fallback_llm.invoke(messages)
            raise

    def _build_system_prompt(self) -> str:
        """Builds the master prompt that defines the interviewer's behavior."""
        persona = PERSONA_INSTRUCTIONS[self.setup.persona]
        interview_style = INTERVIEW_TYPE_INSTRUCTIONS[self.setup.interview_type]

        return f"""You are an experienced interviewer at {self.setup.company}.

YOUR PERSONA:
{persona}

INTERVIEW TYPE:
{interview_style}

JOB DESCRIPTION:
{self.setup.job_description}

CANDIDATE'S RESUME:
{self.setup.resume}

CRITICAL RULES:
1. Ask ONE question at a time. Never bundle multiple questions together.
2. Your responses must be concise - max 2-3 sentences before the question.
3. Reference the candidate's actual resume / JD when relevant.
4. Do NOT give feedback on answers during the interview—save that for after.
5. After {self.TOTAL_QUESTIONS} questions, end with a polite closing.
6. Never break character. You are a human interviewer.
7. Do not mention you are an AI.
"""

    def _format_history_for_llm(self):
        """Convert our message history into LangChain message format."""
        messages = [SystemMessage(content=self._build_system_prompt())]

        for msg in self.history:
            if msg.role == "interviewer":
                messages.append(AIMessage(content=msg.content))
            else:  # candidate
                messages.append(HumanMessage(content=msg.content))

        return messages

    def start_interview(self) -> str:
        """Generates the opening question/greeting."""
        kickoff_prompt = HumanMessage(
            content=(
                "Begin the interview now. Greet the candidate briefly "
                "(1 sentence) and ask your first question."
            )
        )

        messages = self._format_history_for_llm() + [kickoff_prompt]
        response = self._invoke(messages)

        opening = response.content
        self.history.append(Message(role="interviewer", content=opening))
        self.question_count = 1

        return opening

    def respond_to_answer(self, candidate_answer: str) -> tuple[str, bool]:
        """
        Records the candidate's answer and generates the next question.
        Returns: (next_message, is_complete)
        """
        # Save candidate's answer
        self.history.append(Message(role="candidate", content=candidate_answer))

        # Check if we're done
        if self.question_count >= self.TOTAL_QUESTIONS:
            closing_prompt = HumanMessage(
                content=(
                    "Thank the candidate and politely close the interview. "
                    "Do NOT ask another question. Mention they'll receive "
                    "feedback shortly. Keep it to 2-3 sentences."
                )
            )
            messages = self._format_history_for_llm() + [closing_prompt]
            response = self._invoke(messages)
            closing = response.content
            self.history.append(Message(role="interviewer", content=closing))
            return closing, True

        # Otherwise, ask the next question
        next_q_prompt = HumanMessage(
            content=(
                "Acknowledge their answer in 1 short sentence (or skip if "
                "adversarial), then ask your next question. Keep digging "
                "deeper into their fit for this role."
            )
        )
        messages = self._format_history_for_llm() + [next_q_prompt]
        response = self._invoke(messages)

        next_message = response.content
        self.history.append(Message(role="interviewer", content=next_message))
        self.question_count += 1

        return next_message, False