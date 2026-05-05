import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from unittest.mock import patch, AsyncMock

# Setup test database (SQLite)
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_create_exam():
    exam_data = {
        "title": "Math 101",
        "subject": "Mathematics",
        "total_marks": 100,
        "grading_mode": "answer_key",
        "questions": [
            {
                "question_text": "What is 2+2?",
                "max_marks": 10,
                "answer_key": "4",
                "order_index": 0
            }
        ]
    }
    response = client.post("/exams", json=exam_data)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Math 101"
    assert len(data["questions"]) == 1
    return data["id"], data["questions"][0]["id"]

@patch("app.routes.grade_answer", new_callable=AsyncMock)
def test_submit_exam(mock_grade, setup_db):
    # First create an exam
    exam_id, q_id = test_create_exam()
    
    mock_grade.return_value = {
        "score": 10.0,
        "feedback": "Perfect answer.",
        "confidence": 1.0
    }
    
    submission_data = {
        "student_name": "John Doe",
        "answers": [
            {
                "question_id": q_id,
                "answer_text": "4"
            }
        ]
    }
    
    response = client.post(f"/exams/{exam_id}/submit", json=submission_data)
    assert response.status_code == 201
    data = response.json()
    assert data["student_name"] == "John Doe"
    assert data["total_score"] == 10.0
    assert len(data["answers"]) == 1
    assert data["answers"][0]["ai_score"] == 10.0

def test_list_submissions():
    # Assuming the previous test created a submission
    # But pytest runs tests in isolation if not careful. 
    # Let's create one within this test for certainty.
    exam_id, q_id = test_create_exam()
    submission_data = {
        "student_name": "Jane Doe",
        "answers": [{"question_id": q_id, "answer_text": "4"}]
    }
    with patch("app.routes.grade_answer", new_callable=AsyncMock) as mock_grade:
        mock_grade.return_value = {"score": 10.0, "feedback": "OK", "confidence": 1.0}
        client.post(f"/exams/{exam_id}/submit", json=submission_data)
    
    response = client.get(f"/exams/{exam_id}/submissions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == "Jane Doe"

def test_override_score():
    exam_id, q_id = test_create_exam()
    submission_data = {
        "student_name": "Bob",
        "answers": [{"question_id": q_id, "answer_text": "Wrong"}]
    }
    with patch("app.routes.grade_answer", new_callable=AsyncMock) as mock_grade:
        mock_grade.return_value = {"score": 0.0, "feedback": "Wrong", "confidence": 1.0}
        resp = client.post(f"/exams/{exam_id}/submit", json=submission_data)
        answer_id = resp.json()["answers"][0]["id"]
    
    # Override to 5
    override_data = {"instructor_score": 5.0}
    response = client.patch(f"/answers/{answer_id}/override", json=override_data)
    assert response.status_code == 200
    assert response.json()["final_score"] == 5.0
    
    # Verify submission total score updated
    sub_id = resp.json()["id"]
    sub_resp = client.get(f"/submissions/{sub_id}")
    assert sub_resp.json()["total_score"] == 5.0

def test_get_analytics():
    exam_id, q_id = test_create_exam()
    # Create a submission
    submission_data = {
        "student_name": "Alice",
        "answers": [{"question_id": q_id, "answer_text": "Correct"}]
    }
    with patch("app.routes.grade_answer", new_callable=AsyncMock) as mock_grade:
        mock_grade.return_value = {"score": 8.0, "feedback": "Good", "confidence": 1.0}
        client.post(f"/exams/{exam_id}/submit", json=submission_data)
    
    response = client.get(f"/exams/{exam_id}/analytics")
    assert response.status_code == 200
    data = response.json()
    assert data["total_submissions"] >= 1
    assert data["average_score"] == 8.0
    assert len(data["question_breakdown"]) == 1
    assert data["question_breakdown"][0]["success_rate"] == 80.0
