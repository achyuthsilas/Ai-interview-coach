"""
Evaluator Agent - Silently scores each candidate answer in real-time.
Uses Groq + Llama 3.3 70B (free tier, very fast).
"""

import os
import json
from typing import Dict
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

load_dotenv()


EVALUATION_PROMPT = """You are an expert interview evaluator working behind the scenes.
You silently analyze candidate answers and score them. The candidate does NOT see your output.

INTERVIEW CONTEXT:
- Company: {company}
- Role / JD: {job_description}
- Interview type: {interview_type}

QUESTION ASKED:
{question}

CANDIDATE'S ANSWER:
{answer}

Evaluate the answer on these dimensions (1-10 scale):
- relevance_score: Did they actually answer the question?
- structure_score: Was the answer well-organized? (STAR format for behavioral)
- depth_score: Did they show technical/strategic depth, or stay surface-level?
- overall_score: Holistic score weighing all factors

Also provide:
- strengths: 1-2 sentences on what was good
- weaknesses: 1-2 sentences on what was weak (be specific!)
- better_answer: A 2-3 sentence improved version of the answer

Respond ONLY with valid JSON in this exact format:
{{
  "relevance_score": <int 1-10>,
  "structure_score": <int 1-10>,
  "depth_score": <int 1-10>,
  "overall_score": <int 1-10>,
  "strengths": "<string>",
  "weaknesses": "<string>",
  "better_answer": "<string>"
}}

Do not include markdown, code fences, or any other text. Just the JSON object.
"""


class EvaluatorAgent:
    """Scores candidate answers in real-time."""

    def __init__(self):
        # llama-3.1-8b-instant: very fast on Groq LPU, good enough for structured JSON scoring
        self.llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.3,
            groq_api_key=os.getenv("GROQ_API_KEY"),
            max_tokens=350,
        )

    def evaluate(
        self,
        question: str,
        answer: str,
        company: str,
        job_description: str,
        interview_type: str,
    ) -> Dict:
        """Score a single Q&A pair. Returns a dict ready to save in DB."""

        prompt = EVALUATION_PROMPT.format(
            company=company,
            job_description=job_description[:600],  # keep token count low
            interview_type=interview_type,
            question=question,
            answer=answer,
        )

        try:
            response = self.llm.invoke([HumanMessage(content=prompt)])
            content = response.content.strip()

            # Strip code fences if Groq adds them despite instructions
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            evaluation = json.loads(content)

            # Add the question and answer for storage
            evaluation["question"] = question
            evaluation["answer"] = answer

            return evaluation

        except (json.JSONDecodeError, Exception) as e:
            print(f"⚠️ Evaluator failed: {e}")
            # Fallback evaluation so the app doesn't crash
            return {
                "question": question,
                "answer": answer,
                "relevance_score": 5,
                "structure_score": 5,
                "depth_score": 5,
                "overall_score": 5,
                "strengths": "Could not evaluate (parsing error)",
                "weaknesses": "Could not evaluate (parsing error)",
                "better_answer": "Could not generate (parsing error)",
            }