import json
import re

import httpx

from app.config import settings

GRADING_SYSTEM_PROMPT = """You are an expert academic grader. Your job is to grade a student's answer to an exam question and provide detailed, constructive feedback — exactly as a skilled, fair teacher would.

You will be given:
- The question
- The maximum marks available
- Either an answer key, a grading rubric, or relevant course material
- The student's answer

You must return a JSON object with exactly these fields:
{
  "score": <number, between 0 and max_marks>,
  "feedback": "<string, 3-6 sentences — what the student got right, what they got wrong, why marks were lost, and one specific thing they should study or improve>",
  "confidence": <number between 0 and 1 — how confident you are in this grade>
}

Grading rules:
- Be fair and consistent. Grade the answer, not the writing style.
- Award partial credit for partially correct answers.
- If the answer is creative or unconventional but still correct, give full marks.
- Never penalize for good-faith attempts that show understanding.
- If confidence is below 0.7, note in the feedback that the instructor should review this grade.
- Return ONLY the JSON object. No preamble, no explanation outside the JSON."""

ARABIC_SYSTEM_PROMPT_ADDITION = """
The exam is in Arabic. Grade the student's Arabic answer against the Arabic question and rubric/answer key. Return your feedback in Arabic (Modern Standard Arabic — فصحى). Keep JSON field names in English. The feedback must be written in clear, encouraging Arabic appropriate for a student. Do not mix languages in the feedback."""

COURSE_MATERIAL_SYSTEM_PROMPT = """You are an expert academic grader. The instructor has provided course material instead of an answer key. Your job is to:
1. Read the course material carefully
2. Infer what the correct answer to the question should be based on that material
3. Grade the student's answer against your inferred correct answer

You must return a JSON object with exactly these fields:
{
  "score": <number, between 0 and max_marks>,
  "feedback": "<string, 3-6 sentences — cite the relevant part of the course material, explain what the student got right/wrong, and give one specific improvement tip>",
  "confidence": <number between 0 and 1>
}

Return ONLY the JSON object. No preamble."""


def is_arabic(text: str) -> bool:
    """Detect Arabic Unicode characters."""
    return bool(re.search(r"[\u0600-\u06FF]", text))


async def grade_answer(
    question_text: str,
    max_marks: int,
    grading_mode: str,
    answer_key: str | None,
    rubric: str | None,
    student_answer: str,
    course_material: str | None = None,
) -> dict:
    """
    Route to Groq (English) or Gemini Flash (Arabic) and return grading result.
    Returns: {"score": float, "feedback": str, "confidence": float}
    """
    arabic = is_arabic(question_text)

    # Early exit if the right key is missing
    if arabic and not settings.google_ai_api_key:
        raise ValueError("GOOGLE_AI_API_KEY is not set. Add it to .env to enable Arabic grading.")
    if not arabic and not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not set. Add it to .env to enable AI grading.")

    # Build prompt based on grading mode
    if grading_mode == "course_material" and course_material:
        system_prompt = COURSE_MATERIAL_SYSTEM_PROMPT
        if arabic:
            system_prompt += ARABIC_SYSTEM_PROMPT_ADDITION
        user_message = (
            f"Course material:\n{course_material[:8000]}\n\n"
            f"Question: {question_text}\n"
            f"Maximum marks: {max_marks}\n"
            f"Student's answer: {student_answer}"
        )
    else:
        system_prompt = GRADING_SYSTEM_PROMPT
        if arabic:
            system_prompt += ARABIC_SYSTEM_PROMPT_ADDITION
        grading_reference = answer_key if grading_mode == "answer_key" else rubric
        user_message = (
            f"Question: {question_text}\n"
            f"Maximum marks: {max_marks}\n"
            f"{'Answer key' if grading_mode == 'answer_key' else 'Grading rubric'}: {grading_reference}\n"
            f"Student's answer: {student_answer}"
        )

    if arabic:
        result = await _call_gemini(system_prompt, user_message)
    else:
        result = await _call_groq(system_prompt, user_message)

    # Clamp score between 0 and max_marks
    result["score"] = max(0.0, min(float(max_marks), float(result.get("score", 0))))
    result["confidence"] = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
    return result


async def infer_weak_areas(student_name: str, low_score_questions: list[dict]) -> list[dict]:
    """
    Cluster questions a student consistently scores badly on into topic groups.
    low_score_questions: list of {question_text, avg_score_pct, count}
    Returns: list of {topic, avg_score_pct, question_count}
    """
    if not low_score_questions or not settings.groq_api_key:
        return []

    prompt = (
        "You are an educational analyst. Given the following list of exam questions that a student "
        "consistently answered poorly, group them into 2-5 topic areas. For each topic, give the "
        "average score percentage and a tip for improvement.\n\n"
        "Return ONLY a JSON array: [{\"topic\": str, \"avg_score_pct\": float, \"question_count\": int, \"tip\": str}]\n\n"
        "Questions:\n" +
        "\n".join(f"- {q['question_text']} (avg: {q['avg_score_pct']:.0f}%)" for q in low_score_questions[:20])
    )

    try:
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            resp.raise_for_status()
            data = json.loads(resp.json()["choices"][0]["message"]["content"])
            # Groq may return {"weak_areas": [...]} or just [...]
            if isinstance(data, list):
                return data
            for v in data.values():
                if isinstance(v, list):
                    return v
    except Exception:
        pass
    return []


async def _call_groq(system_prompt: str, user_message: str) -> dict:
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)


async def _call_gemini(system_prompt: str, user_message: str) -> dict:
    """Call Gemini Flash via OpenAI-compatible endpoint."""
    headers = {
        "Authorization": f"Bearer {settings.google_ai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "gemini-2.0-flash",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    import asyncio
    for attempt in range(2):  # 1 retry on 429
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                headers=headers,
                json=payload,
            )
            if resp.status_code == 429 and attempt == 0:
                await asyncio.sleep(6)
                continue
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    raise RuntimeError("Gemini Flash rate limit — retry later")
