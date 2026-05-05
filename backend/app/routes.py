import csv
import io
import json
from collections import defaultdict

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.grading import grade_answer, infer_weak_areas
from app.ocr import extract_text, save_upload
from app.plagiarism import check_plagiarism

router = APIRouter()


# ── POST /exams ───────────────────────────────────────────────────────────────

@router.post("/exams", response_model=schemas.ExamOut, status_code=201)
def create_exam(exam_in: schemas.ExamCreate, db: Session = Depends(get_db)):
    exam = models.Exam(
        title=exam_in.title,
        subject=exam_in.subject,
        total_marks=exam_in.total_marks,
        grading_mode=exam_in.grading_mode,
    )
    db.add(exam)
    db.flush()
    for q in exam_in.questions:
        question = models.Question(
            exam_id=exam.id,
            question_text=q.question_text,
            max_marks=q.max_marks,
            answer_key=q.answer_key,
            rubric=q.rubric,
            order_index=q.order_index,
        )
        db.add(question)
    db.commit()
    db.refresh(exam)
    return exam


# ── POST /exams/with-material (Phase 2: course material mode) ─────────────────

@router.post("/exams/with-material", response_model=schemas.ExamOut, status_code=201)
async def create_exam_with_material(
    exam_json: str = Form(...),
    material_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Create an exam where the AI grades based on uploaded course material.
    exam_json: JSON string matching ExamCreate schema (with grading_mode='course_material')
    material_file: PDF or image of course material
    """
    try:
        exam_data = json.loads(exam_json)
        exam_in = schemas.ExamCreate(**exam_data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid exam JSON: {e}")

    # Save and extract course material text
    contents = await material_file.read()
    file_path = save_upload(contents, material_file.filename or "material.pdf")
    try:
        material_text = extract_text(file_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read course material: {e}")

    exam = models.Exam(
        title=exam_in.title,
        subject=exam_in.subject,
        total_marks=exam_in.total_marks,
        grading_mode="course_material",
        course_material_text=material_text,
    )
    db.add(exam)
    db.flush()
    for q in exam_in.questions:
        question = models.Question(
            exam_id=exam.id,
            question_text=q.question_text,
            max_marks=q.max_marks,
            order_index=q.order_index,
        )
        db.add(question)
    db.commit()
    db.refresh(exam)
    return exam


# ── GET /exams/:id ────────────────────────────────────────────────────────────

@router.get("/exams/{exam_id}", response_model=schemas.ExamOut)
def get_exam(exam_id: str, db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


# ── POST /exams/:id/submit ────────────────────────────────────────────────────

@router.post("/exams/{exam_id}/submit", response_model=schemas.SubmissionOut, status_code=201)
async def submit_answers(
    exam_id: str,
    submission_in: schemas.SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    submission = models.Submission(exam_id=exam_id, student_name=submission_in.student_name)
    db.add(submission)
    db.flush()

    total = 0.0
    answer_records = []

    for ans_in in submission_in.answers:
        question = (
            db.query(models.Question)
            .filter(models.Question.id == ans_in.question_id, models.Question.exam_id == exam_id)
            .first()
        )
        if not question:
            raise HTTPException(status_code=404, detail=f"Question {ans_in.question_id} not found")

        try:
            result = await grade_answer(
                question_text=question.question_text,
                max_marks=question.max_marks,
                grading_mode=exam.grading_mode,
                answer_key=question.answer_key,
                rubric=question.rubric,
                student_answer=ans_in.answer_text,
                course_material=exam.course_material_text,
            )
        except Exception as e:
            result = {
                "score": 0.0,
                "feedback": f"Grading failed — instructor review required. Error: {str(e)[:200]}",
                "confidence": 0.0,
            }

        answer = models.Answer(
            submission_id=submission.id,
            question_id=ans_in.question_id,
            answer_text=ans_in.answer_text,
            ai_score=result["score"],
            instructor_score=None,
            final_score=result["score"],
            ai_feedback=result["feedback"],
            ai_confidence=result["confidence"],
        )
        db.add(answer)
        answer_records.append(answer)
        total += result["score"]

    submission.total_score = total
    db.commit()
    db.refresh(submission)

    # Run plagiarism check in background (non-blocking)
    background_tasks.add_task(_run_plagiarism_check, submission.id, exam_id, db)

    return schemas.SubmissionOut.from_orm_with_questions(submission)


# ── POST /exams/:id/submit/upload (Phase 2: file upload) ─────────────────────

@router.post("/exams/{exam_id}/submit/upload", status_code=201)
async def submit_answers_upload(
    exam_id: str,
    background_tasks: BackgroundTasks,
    student_name: str = Form(...),
    question_ids: str = Form(...),   # comma-separated question IDs in order
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """
    Submit answers as file uploads (photos/PDFs of handwritten answers).
    Files must be in the same order as question_ids.
    """
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    qids = [q.strip() for q in question_ids.split(",")]
    if len(qids) != len(files):
        raise HTTPException(status_code=422, detail="Number of files must match number of question_ids")

    submission = models.Submission(exam_id=exam_id, student_name=student_name)
    db.add(submission)
    db.flush()

    total = 0.0

    for qid, upload in zip(qids, files):
        question = (
            db.query(models.Question)
            .filter(models.Question.id == qid, models.Question.exam_id == exam_id)
            .first()
        )
        if not question:
            raise HTTPException(status_code=404, detail=f"Question {qid} not found")

        # Save file and extract text via OCR
        contents = await upload.read()
        file_path = save_upload(contents, upload.filename or "answer.jpg")
        try:
            extracted_text = extract_text(file_path)
        except Exception as e:
            extracted_text = f"[OCR failed: {e}]"

        try:
            result = await grade_answer(
                question_text=question.question_text,
                max_marks=question.max_marks,
                grading_mode=exam.grading_mode,
                answer_key=question.answer_key,
                rubric=question.rubric,
                student_answer=extracted_text,
                course_material=exam.course_material_text,
            )
        except Exception as e:
            result = {"score": 0.0, "feedback": f"Grading failed: {e}", "confidence": 0.0}

        answer = models.Answer(
            submission_id=submission.id,
            question_id=qid,
            answer_text=extracted_text,
            answer_file_path=file_path,
            ai_score=result["score"],
            instructor_score=None,
            final_score=result["score"],
            ai_feedback=result["feedback"],
            ai_confidence=result["confidence"],
        )
        db.add(answer)
        total += result["score"]

    submission.total_score = total
    db.commit()
    db.refresh(submission)
    background_tasks.add_task(_run_plagiarism_check, submission.id, exam_id, db)
    return schemas.SubmissionOut.from_orm_with_questions(submission)


# ── GET /exams/:id/submissions ────────────────────────────────────────────────

@router.get("/exams/{exam_id}/submissions", response_model=list[schemas.SubmissionSummary])
def list_submissions(exam_id: str, db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    result = []
    for sub in exam.submissions:
        has_flag = any(a.plagiarism_flagged for a in sub.answers)
        result.append(schemas.SubmissionSummary(
            id=sub.id,
            student_name=sub.student_name,
            total_score=sub.total_score,
            submitted_at=sub.submitted_at,
            has_plagiarism_flag=has_flag,
        ))
    return result


# ── GET /submissions/:id ──────────────────────────────────────────────────────

@router.get("/submissions/{submission_id}")
def get_submission(submission_id: str, db: Session = Depends(get_db)):
    submission = (
        db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return schemas.SubmissionOut.from_orm_with_questions(submission)


# ── PATCH /answers/:id/override ───────────────────────────────────────────────

@router.patch("/answers/{answer_id}/override", response_model=schemas.AnswerOut)
def override_score(
    answer_id: str, override_in: schemas.OverrideScore, db: Session = Depends(get_db)
):
    answer = db.query(models.Answer).filter(models.Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    question = db.query(models.Question).filter(models.Question.id == answer.question_id).first()
    clamped = max(0.0, min(float(question.max_marks), override_in.instructor_score))

    answer.instructor_score = clamped
    answer.final_score = clamped

    submission = (
        db.query(models.Submission).filter(models.Submission.id == answer.submission_id).first()
    )
    submission.total_score = sum((a.final_score or 0.0) for a in submission.answers)
    db.commit()
    db.refresh(answer)
    # Return enriched answer with question info
    q = answer.question
    return schemas.AnswerOut(
        id=answer.id,
        question_id=answer.question_id,
        question_text=q.question_text if q else None,
        max_marks=q.max_marks if q else None,
        answer_text=answer.answer_text,
        answer_file_path=answer.answer_file_path,
        ai_score=answer.ai_score,
        instructor_score=answer.instructor_score,
        final_score=answer.final_score,
        ai_feedback=answer.ai_feedback,
        ai_confidence=answer.ai_confidence,
        plagiarism_score=answer.plagiarism_score,
        plagiarism_flagged=answer.plagiarism_flagged,
    )


# ── GET /exams/:id/export/csv ─────────────────────────────────────────────────

@router.get("/exams/{exam_id}/export/csv")
def export_csv(exam_id: str, db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    output = io.StringIO()
    questions = exam.questions
    q_headers = [f"Q{i+1} Score (/{q.max_marks})" for i, q in enumerate(questions)]
    flag_headers = [f"Q{i+1} Plagiarism" for i in range(len(questions))]
    writer = csv.writer(output)
    writer.writerow(["Student Name", "Total Score", f"Total / {exam.total_marks}"] + q_headers + flag_headers)

    for sub in exam.submissions:
        answers_by_q = {a.question_id: a for a in sub.answers}
        per_q = [answers_by_q.get(q.id) for q in questions]
        per_q_scores = [a.final_score if a else "" for a in per_q]
        per_q_flags = ["⚠️" if (a and a.plagiarism_flagged) else "" for a in per_q]
        writer.writerow([sub.student_name, sub.total_score, exam.total_marks] + per_q_scores + per_q_flags)

    output.seek(0)
    filename = f"gradeai_{exam_id[:8]}_grades.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── GET /students/:name/progress (Phase 2) ────────────────────────────────────

@router.get("/students/{student_name}/progress", response_model=schemas.StudentProgress)
async def get_student_progress(student_name: str, db: Session = Depends(get_db)):
    submissions = (
        db.query(models.Submission)
        .filter(models.Submission.student_name == student_name)
        .order_by(models.Submission.submitted_at.asc())
        .all()
    )
    if not submissions:
        raise HTTPException(status_code=404, detail=f"No submissions found for student '{student_name}'")

    submission_briefs = []
    subject_data: dict[str, list[float]] = defaultdict(list)
    low_score_questions = []

    for sub in submissions:
        exam = sub.exam
        max_score = float(exam.total_marks) if exam.total_marks else 1
        score = sub.total_score or 0.0
        pct = round((score / max_score) * 100, 1) if max_score > 0 else 0.0

        submission_briefs.append(schemas.SubmissionBrief(
            submission_id=sub.id,
            exam_title=exam.title,
            subject=exam.subject,
            score=score,
            max_score=max_score,
            score_pct=pct,
            submitted_at=sub.submitted_at,
        ))
        subject_data[exam.subject].append(pct)

        # Collect questions with < 60% score for weak area analysis
        for a in sub.answers:
            q = a.question
            if q and a.final_score is not None:
                q_pct = round((a.final_score / q.max_marks) * 100, 1) if q.max_marks > 0 else 0
                if q_pct < 60:
                    low_score_questions.append({
                        "question_text": q.question_text,
                        "avg_score_pct": q_pct,
                        "count": 1,
                    })

    # Subject performance
    subject_performance = [
        schemas.SubjectPerformance(
            subject=subj,
            avg_score_pct=round(sum(scores) / len(scores), 1),
            submission_count=len(scores),
        )
        for subj, scores in subject_data.items()
    ]

    overall_avg = round(
        sum(b.score_pct for b in submission_briefs) / len(submission_briefs), 1
    ) if submission_briefs else 0.0

    # AI-inferred weak areas (Groq)
    weak_area_dicts = await infer_weak_areas(student_name, low_score_questions)
    weak_areas = [
        schemas.WeakArea(
            topic=w.get("topic", "Unknown"),
            avg_score_pct=w.get("avg_score_pct", 0),
            question_count=w.get("question_count", len(low_score_questions)),
            tip=w.get("tip"),
        )
        for w in weak_area_dicts
    ]

    return schemas.StudentProgress(
        student_name=student_name,
        total_submissions=len(submissions),
        average_score_pct=overall_avg,
        submissions=submission_briefs,
        subject_performance=subject_performance,
        weak_areas=weak_areas,
    )


# ── GET /exams/:id/analytics ──────────────────────────────────────────────────

@router.get("/exams/{exam_id}/analytics", response_model=schemas.ClassAnalytics)
def get_exam_analytics(exam_id: str, db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    submissions = exam.submissions
    if not submissions:
        return schemas.ClassAnalytics(
            exam_id=exam.id,
            exam_title=exam.title,
            total_submissions=0,
            average_score=0,
            average_pct=0,
            score_distribution={},
            question_breakdown=[],
        )

    total_subs = len(submissions)
    avg_score = sum(s.total_score or 0 for s in submissions) / total_subs
    avg_pct = (avg_score / exam.total_marks * 100) if exam.total_marks > 0 else 0

    # Distribution
    dist = {"0-20%": 0, "21-40%": 0, "41-60%": 0, "61-80%": 0, "81-100%": 0}
    for sub in submissions:
        pct = ((sub.total_score or 0) / exam.total_marks * 100) if exam.total_marks > 0 else 0
        if pct <= 20: dist["0-20%"] += 1
        elif pct <= 40: dist["21-40%"] += 1
        elif pct <= 60: dist["41-60%"] += 1
        elif pct <= 80: dist["61-80%"] += 1
        else: dist["81-100%"] += 1

    # Question breakdown
    q_stats = []
    for q in exam.questions:
        ans_scores = [a.final_score for a in q.answers if a.final_score is not None]
        q_avg = sum(ans_scores) / len(ans_scores) if ans_scores else 0
        q_stats.append(schemas.QuestionAnalytics(
            question_id=q.id,
            question_text=q.question_text,
            avg_score=round(q_avg, 1),
            max_marks=q.max_marks,
            success_rate=round((q_avg / q.max_marks * 100), 1) if q.max_marks > 0 else 0
        ))

    return schemas.ClassAnalytics(
        exam_id=exam.id,
        exam_title=exam.title,
        total_submissions=total_subs,
        average_score=round(avg_score, 1),
        average_pct=round(avg_pct, 1),
        score_distribution=dist,
        question_breakdown=q_stats,
    )


# ── Background: plagiarism check ──────────────────────────────────────────────

async def _run_plagiarism_check(submission_id: str, exam_id: str, db: Session):
    """
    Background task: compare each answer against all previous answers to the same question.
    Updates plagiarism_score and plagiarism_flagged on the Answer model.
    """
    try:
        submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
        if not submission:
            return

        for answer in submission.answers:
            # Get all OTHER answers to the same question (excluding this submission)
            other_answers = (
                db.query(models.Answer)
                .join(models.Submission)
                .filter(
                    models.Answer.question_id == answer.question_id,
                    models.Submission.exam_id == exam_id,
                    models.Answer.submission_id != submission_id,
                )
                .all()
            )
            other_texts = [a.answer_text for a in other_answers if a.answer_text]
            if not other_texts:
                continue

            score, flagged = await check_plagiarism(answer.answer_text, other_texts)
            answer.plagiarism_score = score
            answer.plagiarism_flagged = flagged

        db.commit()
    except Exception:
        pass  # Never crash the background task
