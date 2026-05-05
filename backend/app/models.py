import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    exams = relationship("Exam", back_populates="owner")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=True) # Nullable for now to support old data
    title = Column(Text, nullable=False)
    subject = Column(Text, nullable=False)
    total_marks = Column(Integer, nullable=False)
    grading_mode = Column(String(20), nullable=False)  # 'answer_key' | 'rubric' | 'course_material'
    course_material_text = Column(Text, nullable=True)  # Phase 2: uploaded course doc text
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="exams")
    questions = relationship("Question", back_populates="exam", order_by="Question.order_index")
    submissions = relationship("Submission", back_populates="exam")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    max_marks = Column(Integer, nullable=False)
    answer_key = Column(Text, nullable=True)
    rubric = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)

    exam = relationship("Exam", back_populates="questions")
    answers = relationship("Answer", back_populates="question")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False)
    student_name = Column(Text, nullable=False)
    total_score = Column(Float, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    exam = relationship("Exam", back_populates="submissions")
    answers = relationship("Answer", back_populates="submission")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    submission_id = Column(String(36), ForeignKey("submissions.id"), nullable=False)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False)
    answer_text = Column(Text, nullable=False)
    answer_file_path = Column(Text, nullable=True)        # Phase 2: path to uploaded file
    ai_score = Column(Float, nullable=True)
    instructor_score = Column(Float, nullable=True)       # null until override
    final_score = Column(Float, nullable=True)            # instructor_score if set, else ai_score
    ai_feedback = Column(Text, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    plagiarism_score = Column(Float, nullable=True)       # Phase 2: 0.0–1.0 similarity
    plagiarism_flagged = Column(Boolean, default=False)   # Phase 2: True if > threshold

    submission = relationship("Submission", back_populates="answers")
    question = relationship("Question", back_populates="answers")
