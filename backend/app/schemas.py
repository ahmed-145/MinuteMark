from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── Question schemas ──────────────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    question_text: str
    max_marks: int
    answer_key: Optional[str] = None
    rubric: Optional[str] = None
    order_index: int = 0


class QuestionOut(BaseModel):
    id: str
    question_text: str
    max_marks: int
    order_index: int
    answer_key: Optional[str] = None
    rubric: Optional[str] = None

    class Config:
        from_attributes = True


# ── Exam schemas ──────────────────────────────────────────────────────────────

class ExamCreate(BaseModel):
    title: str
    subject: str
    total_marks: int
    grading_mode: str  # 'answer_key' | 'rubric' | 'course_material'
    questions: list[QuestionCreate]


class ExamOut(BaseModel):
    id: str
    title: str
    subject: str
    total_marks: int
    grading_mode: str
    course_material_text: Optional[str] = None
    created_at: datetime
    questions: list[QuestionOut]

    class Config:
        from_attributes = True


class ExamSummary(BaseModel):
    id: str
    title: str
    subject: str
    total_marks: int
    grading_mode: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Submission / Answer schemas ───────────────────────────────────────────────

class AnswerSubmit(BaseModel):
    question_id: str
    answer_text: str


class SubmissionCreate(BaseModel):
    student_name: str
    answers: list[AnswerSubmit]


class AnswerOut(BaseModel):
    id: str
    question_id: str
    question_text: Optional[str] = None
    max_marks: Optional[int] = None
    answer_text: str
    answer_file_path: Optional[str] = None
    ai_score: Optional[float]
    instructor_score: Optional[float]
    final_score: Optional[float]
    ai_feedback: Optional[str]
    ai_confidence: Optional[float]
    plagiarism_score: Optional[float] = None
    plagiarism_flagged: Optional[bool] = False

    class Config:
        from_attributes = True


class SubmissionOut(BaseModel):
    id: str
    exam_id: str
    student_name: str
    total_score: Optional[float]
    submitted_at: datetime
    answers: list[AnswerOut]

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_questions(cls, submission):
        """Build response with question_text/max_marks joined in."""
        answers_out = []
        for a in submission.answers:
            q = a.question
            answers_out.append(AnswerOut(
                id=a.id,
                question_id=a.question_id,
                question_text=q.question_text if q else None,
                max_marks=q.max_marks if q else None,
                answer_text=a.answer_text,
                answer_file_path=a.answer_file_path,
                ai_score=a.ai_score,
                instructor_score=a.instructor_score,
                final_score=a.final_score,
                ai_feedback=a.ai_feedback,
                ai_confidence=a.ai_confidence,
                plagiarism_score=a.plagiarism_score,
                plagiarism_flagged=a.plagiarism_flagged,
            ))
        return cls(
            id=submission.id,
            exam_id=submission.exam_id,
            student_name=submission.student_name,
            total_score=submission.total_score,
            submitted_at=submission.submitted_at,
            answers=answers_out,
        )


class SubmissionSummary(BaseModel):
    id: str
    student_name: str
    total_score: Optional[float]
    submitted_at: datetime
    has_plagiarism_flag: bool = False

    class Config:
        from_attributes = True


# ── Override schema ───────────────────────────────────────────────────────────

class OverrideScore(BaseModel):
    instructor_score: float


# ── Progress schemas ──────────────────────────────────────────────────────────

class SubmissionBrief(BaseModel):
    submission_id: str
    exam_title: str
    subject: str
    score: float
    max_score: float
    score_pct: float
    submitted_at: datetime


class WeakArea(BaseModel):
    topic: str
    avg_score_pct: float
    question_count: int
    tip: Optional[str] = None


class SubjectPerformance(BaseModel):
    subject: str
    avg_score_pct: float
    submission_count: int


class StudentProgress(BaseModel):
    student_name: str
    total_submissions: int
    average_score_pct: float
    submissions: list[SubmissionBrief]
    subject_performance: list[SubjectPerformance]
    weak_areas: list[WeakArea]


# ── Analytics schemas ─────────────────────────────────────────────────────────

class QuestionAnalytics(BaseModel):
    question_id: str
    question_text: str
    avg_score: float
    max_marks: int
    success_rate: float


class ClassAnalytics(BaseModel):
    exam_id: str
    exam_title: str
    total_submissions: int
    average_score: float
    average_pct: float
    score_distribution: dict[str, int]
    question_breakdown: list[QuestionAnalytics]


# ── Auth schemas ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
