"""
Plagiarism detection service.
Compares a student's answer against all existing answers to the same question
and flags suspiciously similar pairs using LLM-based semantic similarity.
"""
import json
import httpx
from app.config import settings


PLAGIARISM_PROMPT = """You are a plagiarism detector. Compare the following two student answers and rate how similar they are on a scale of 0.0 to 1.0, where:
- 0.0 = completely different answers
- 0.5 = similar topic but different wording / independent work
- 0.85+ = suspiciously similar — likely copied or shared

Return ONLY a JSON object: {"similarity": <float 0.0–1.0>, "reason": "<one sentence explanation>"}"""

PLAGIARISM_THRESHOLD = 0.85


async def check_plagiarism(new_answer: str, existing_answers: list[str]) -> tuple[float, bool]:
    """
    Compare new_answer against all existing_answers.
    Returns (max_similarity_score, is_flagged).
    Short-circuits as soon as a score > threshold is found.
    """
    if not existing_answers or not settings.groq_api_key:
        return 0.0, False

    max_similarity = 0.0

    for existing in existing_answers:
        # Skip if answer is very short — not enough to compare
        if len(new_answer.strip()) < 20 or len(existing.strip()) < 20:
            continue

        score = await _similarity_score(new_answer, existing)
        max_similarity = max(max_similarity, score)

        if max_similarity >= PLAGIARISM_THRESHOLD:
            break  # No need to check more

    return max_similarity, max_similarity >= PLAGIARISM_THRESHOLD


async def _similarity_score(answer_a: str, answer_b: str) -> float:
    """Ask Groq to rate the similarity between two answers."""
    try:
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        user_message = (
            f"Answer A:\n{answer_a[:1000]}\n\n"
            f"Answer B:\n{answer_b[:1000]}"
        )
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": PLAGIARISM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = json.loads(resp.json()["choices"][0]["message"]["content"])
            return float(data.get("similarity", 0.0))
    except Exception:
        return 0.0  # Fail silently — plagiarism check is non-blocking
