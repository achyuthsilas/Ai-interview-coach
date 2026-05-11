"""
Coach Agent - Generates the final feedback report after the interview.
Aggregates all evaluator outputs + memory patterns into a personalized report.
"""

import os
import json
from typing import Dict, List
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

load_dotenv()


COACHING_PROMPT = """You are a senior career coach reviewing a mock interview.

CONTEXT:
- Company: {company}
- Role: {job_description}
- Interview type: {interview_type}

ALL Q&A EVALUATIONS FROM THIS SESSION:
{evaluations}

PAST PATTERNS FROM PREVIOUS SESSIONS (if any):
{past_patterns}

Synthesize a final coaching report. Be specific, actionable, and honest.
Do NOT be falsely encouraging — the candidate needs real feedback.

Respond ONLY with valid JSON in this exact format:
{{
  "overall_score": <int 1-100>,
  "summary": "<3-4 sentences summarizing performance>",
  "top_strengths": "<bulleted list of 3 strengths, separated by newlines, each starting with '• '>",
  "top_weaknesses": "<bulleted list of 3 weaknesses, separated by newlines, each starting with '• '>",
  "action_items": "<bulleted list of 3-5 concrete things to practice, separated by newlines, each starting with '• '>",
  "recurring_patterns": "<1-2 sentences on patterns recurring from past sessions, or 'No prior data' if none>"
}}

Do not include markdown, code fences, or any other text.
"""


class CoachAgent:
    """Generates the final coaching report."""

    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.5,
            google_api_key=os.getenv("GEMINI_API_KEY"),
        )

    def generate_report(
        self,
        company: str,
        job_description: str,
        interview_type: str,
        evaluations: List[Dict],
        past_patterns: List[Dict],
    ) -> Dict:
        """Build the final coaching report."""

        # Format evaluations for the prompt
        eval_text = ""
        for i, e in enumerate(evaluations, 1):
            eval_text += f"\nQuestion {i}: {e.get('question', '')}\n"
            eval_text += f"Answer: {e.get('answer', '')}\n"
            eval_text += f"Scores: relevance={e.get('relevance_score')}, structure={e.get('structure_score')}, depth={e.get('depth_score')}, overall={e.get('overall_score')}\n"
            eval_text += f"Strengths: {e.get('strengths', '')}\n"
            eval_text += f"Weaknesses: {e.get('weaknesses', '')}\n"

        # Format past patterns
        if past_patterns:
            pattern_text = "\n".join([
                f"- {p['description']} (seen {p['occurrences']} times)"
                for p in past_patterns
            ])
        else:
            pattern_text = "No prior session data."

        prompt = COACHING_PROMPT.format(
            company=company,
            job_description=job_description,
            interview_type=interview_type,
            evaluations=eval_text,
            past_patterns=pattern_text,
        )

        try:
            response = self.llm.invoke([HumanMessage(content=prompt)])
            content = response.content.strip()

            # Clean code fences
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            return json.loads(content)

        except Exception as e:
            print(f"⚠️ Coach failed: {e}")
            return {
                "overall_score": 50,
                "summary": "Could not generate detailed report due to a parsing error.",
                "top_strengths": "• Completed the interview\n• Engaged with questions\n• Provided answers",
                "top_weaknesses": "• Report generation failed",
                "action_items": "• Try the interview again",
                "recurring_patterns": "Could not analyze.",
            }

    def extract_patterns(self, evaluations: List[Dict]) -> List[Dict]:
        """
        Extract recurring patterns from this session for long-term memory.
        Each pattern is something to watch for in future sessions.
        """
        patterns = []
        weak_dimensions = []

        for e in evaluations:
            if e.get("structure_score", 10) <= 5:
                weak_dimensions.append("structure")
            if e.get("depth_score", 10) <= 5:
                weak_dimensions.append("depth")
            if e.get("relevance_score", 10) <= 5:
                weak_dimensions.append("relevance")

        # Tally
        from collections import Counter
        counts = Counter(weak_dimensions)

        for dim, count in counts.items():
            if count >= 2:  # Appears in 2+ answers
                patterns.append({
                    "pattern_type": "weakness",
                    "description": f"Consistently weak on {dim} ({count} answers)",
                })

        return patterns