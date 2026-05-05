import pytest
import os
from unittest.mock import patch, MagicMock, AsyncMock
from app.ocr import extract_text, save_upload
from app.grading import grade_answer
from app.routes import _run_plagiarism_check
from sqlalchemy.orm import Session

@pytest.fixture
def db_session():
    return MagicMock(spec=Session)

@pytest.mark.asyncio
async def test_ocr_dispatch_txt(tmp_path):
    # Test plain text extraction
    d = tmp_path / "test.txt"
    d.write_text("Hello OCR world", encoding="utf-8")
    assert extract_text(str(d)) == "Hello OCR world"

@patch("app.grading._call_groq", new_callable=AsyncMock)
@patch("app.grading._call_gemini", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_grading_routing(mock_gemini, mock_groq):
    # English routing
    mock_groq.return_value = {"score": 5, "feedback": "Good", "confidence": 0.9}
    res = await grade_answer("Question?", 10, "answer_key", "Key", None, "Answer")
    mock_groq.assert_called_once()
    assert res["score"] == 5

    # Arabic routing
    mock_gemini.return_value = {"score": 8, "feedback": "ممتاز", "confidence": 0.9}
    res_ar = await grade_answer("ما هو؟", 10, "answer_key", "مفتاح", None, "جواب")
    mock_gemini.assert_called_once()
    assert res_ar["score"] == 8

@patch("app.routes.check_plagiarism", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_plagiarism_background_task(mock_check, db_session):
    # This requires a real or mock DB session. 
    # Since we are in 'god mode', I'll ensure we have a valid mock flow.
    mock_check.return_value = (0.95, True)
    
    # Mocking DB objects
    class MockAnswer:
        def __init__(self, text, qid):
            self.id = "ans1"
            self.answer_text = text
            self.question_id = qid
            self.plagiarism_score = 0.0
            self.plagiarism_flagged = False

    mock_answer = MockAnswer("Copied text", "q1")
    
    mock_other = MagicMock()
    mock_other.answer_text = "Original text"
    
    mock_sub = MagicMock()
    mock_sub.answers = [mock_answer]
    
    mock_db = MagicMock(spec=Session)
    mock_db.query().filter().first.return_value = mock_sub
    mock_db.query().join().filter().all.return_value = [mock_other]
    
    from app.routes import _run_plagiarism_check
    await _run_plagiarism_check("sub_id", "exam_id", mock_db)
    
    assert mock_answer.plagiarism_flagged is True
    assert mock_answer.plagiarism_score == 0.95
    mock_db.commit.assert_called()
