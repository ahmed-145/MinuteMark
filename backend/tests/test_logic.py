import pytest
from app.grading import is_arabic, grade_answer
from app.plagiarism import check_plagiarism
from unittest.mock import patch, AsyncMock

def test_is_arabic():
    assert is_arabic("Hello") is False
    assert is_arabic("مرحبا") is True
    assert is_arabic("Mixed hello مرحبا") is True

@pytest.mark.asyncio
async def test_check_plagiarism_mock():
    # Mocking similarity score to avoid real AI calls
    with patch("app.plagiarism._similarity_score", new_callable=AsyncMock) as mock_score:
        mock_score.return_value = 0.9
        score, flagged = await check_plagiarism("This is a test answer.", ["This is a test answer."])
        assert score == 0.9
        assert flagged is True

@pytest.mark.asyncio
async def test_check_plagiarism_no_existing():
    score, flagged = await check_plagiarism("Unique answer", [])
    assert score == 0.0
    assert flagged is False

@pytest.mark.asyncio
async def test_grading_logic_clamping():
    # Test that scores are clamped between 0 and max_marks
    with patch("app.grading._call_groq", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = {"score": 15.0, "feedback": "Too high", "confidence": 1.2}
        result = await grade_answer(
            question_text="Q", 
            max_marks=10, 
            grading_mode="answer_key", 
            answer_key="K", 
            rubric=None, 
            student_answer="A"
        )
        assert result["score"] == 10.0
        assert result["confidence"] == 1.0
