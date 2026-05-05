const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    headers: isFormData ? { ...options?.headers } : { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Question {
  id: string;
  question_text: string;
  max_marks: number;
  order_index: number;
  answer_key?: string | null;
  rubric?: string | null;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  total_marks: number;
  grading_mode: string; // 'answer_key' | 'rubric' | 'course_material'
  course_material_text?: string | null;
  created_at: string;
  questions: Question[];
}

export interface Answer {
  id: string;
  question_id: string;
  question_text?: string | null;
  max_marks?: number | null;
  answer_text: string;
  answer_file_path?: string | null;
  ai_score: number | null;
  instructor_score: number | null;
  final_score: number | null;
  ai_feedback: string | null;
  ai_confidence: number | null;
  plagiarism_score?: number | null;
  plagiarism_flagged?: boolean;
}

export interface Submission {
  id: string;
  exam_id: string;
  student_name: string;
  total_score: number | null;
  submitted_at: string;
  answers: Answer[];
}

export interface SubmissionSummary {
  id: string;
  student_name: string;
  total_score: number | null;
  submitted_at: string;
  has_plagiarism_flag?: boolean;
}

// ── Phase 2 Types ──────────────────────────────────────────────────────────────

export interface SubmissionBrief {
  submission_id: string;
  exam_title: string;
  subject: string;
  score: number;
  max_score: number;
  score_pct: number;
  submitted_at: string;
}

export interface WeakArea {
  topic: string;
  avg_score_pct: number;
  question_count: number;
  tip?: string | null;
}

export interface SubjectPerformance {
  subject: string;
  avg_score_pct: number;
  submission_count: number;
}

export interface StudentProgress {
  student_name: string;
  total_submissions: number;
  average_score_pct: number;
  submissions: SubmissionBrief[];
  subject_performance: SubjectPerformance[];
  weak_areas: WeakArea[];
}

export interface QuestionAnalytics {
  question_id: string;
  question_text: string;
  avg_score: number;
  max_marks: number;
  success_rate: number;
}

export interface ClassAnalytics {
  exam_id: string;
  exam_title: string;
  total_submissions: number;
  average_score: number;
  average_pct: number;
  score_distribution: Record<string, number>;
  question_breakdown: QuestionAnalytics[];
}

// ── API functions ──────────────────────────────────────────────────────────────

export const api = {
  createExam: (body: unknown) =>
    apiFetch<Exam>("/exams", { method: "POST", body: JSON.stringify(body) }),

  createExamWithMaterial: (formData: FormData) =>
    apiFetch<Exam>("/exams/with-material", { method: "POST", body: formData }),

  getExam: (id: string) => apiFetch<Exam>(`/exams/${id}`),

  submitAnswers: (examId: string, body: unknown) =>
    apiFetch<Submission>(`/exams/${examId}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  submitAnswersUpload: (examId: string, formData: FormData) =>
    apiFetch<Submission>(`/exams/${examId}/submit/upload`, {
      method: "POST",
      body: formData,
    }),

  getSubmissions: (examId: string) =>
    apiFetch<SubmissionSummary[]>(`/exams/${examId}/submissions`),

  getSubmission: (id: string) => apiFetch<Submission>(`/submissions/${id}`),

  overrideScore: (answerId: string, score: number) =>
    apiFetch<Answer>(`/answers/${answerId}/override`, {
      method: "PATCH",
      body: JSON.stringify({ instructor_score: score }),
    }),

  exportCsvUrl: (examId: string) => `${API_URL}/exams/${examId}/export/csv`,

  getStudentProgress: (name: string) =>
    apiFetch<StudentProgress>(`/students/${encodeURIComponent(name)}/progress`),

  getAnalytics: (examId: string) =>
    apiFetch<ClassAnalytics>(`/exams/${examId}/analytics`),
};
