const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const getAuthToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const isFormData = options?.body instanceof FormData;
  
  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("token");
    if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/register")) {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "An error occurred" }));
    throw new Error(error.detail || "Request failed");
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

export interface Token {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
}

// ── API functions ──────────────────────────────────────────────────────────────

export const api = {
  register: (body: unknown) =>
    apiFetch<User>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: async (email: string, pass: string) => {
    const formData = new FormData();
    formData.append("username", email);
    formData.append("password", pass);
    const data = await apiFetch<Token>("/auth/login", { 
      method: "POST", 
      body: formData 
    });
    if (typeof window !== "undefined") {
      localStorage.setItem("token", data.access_token);
    }
    return data;
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
  },

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
    apiFetch<Submission>(`/exams/${examId}/submit`, {
      method: "POST",
      body: formData,
    }),

  submitBatch: (examId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<{ status: string; students_detected: number; total_pages: number }>(
      `/exams/${examId}/submit/batch`, 
      { method: "POST", body: formData }
    );
  },

  getSubmissions: (examId: string) =>
    apiFetch<SubmissionSummary[]>(`/exams/${examId}/submissions`),

  getSubmission: (id: string) => apiFetch<Submission>(`/submissions/${id}`),

  overrideScore: (answerId: string, score: number) =>
    apiFetch<Answer>(`/answers/${answerId}/override`, {
      method: "PATCH",
      body: JSON.stringify({ instructor_score: score }),
    }),

  exportCsvUrl: (examId: string) => `${API_URL}/exams/${examId}/export/csv`,
  exportCanvasUrl: (examId: string) => `${API_URL}/exams/${examId}/export/canvas`,
  exportMoodleUrl: (examId: string) => `${API_URL}/exams/${examId}/export/moodle`,

  getStudentProgress: (name: string) =>
    apiFetch<StudentProgress>(`/students/${encodeURIComponent(name)}/progress`),

  getAnalytics: (examId: string) =>
    apiFetch<ClassAnalytics>(`/exams/${examId}/analytics`),
};
