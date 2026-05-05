"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Exam } from "@/lib/api";

type InputMode = "type" | "upload";

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputModes, setInputModes] = useState<Record<string, InputMode>>({});
  const [fileAnswers, setFileAnswers] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getExam(id)
      .then(setExam)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load exam"))
      .finally(() => setLoading(false));
  }, [id]);

  const getMode = (qid: string): InputMode => inputModes[qid] || "type";
  const setMode = (qid: string, mode: InputMode) =>
    setInputModes((prev) => ({ ...prev, [qid]: mode }));

  const handleAnswer = (questionId: string, text: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: text }));

  const handleFile = (questionId: string, file: File) =>
    setFileAnswers((prev) => ({ ...prev, [questionId]: file }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam) return;
    setSubmitting(true);
    setError(null);
    try {
      const hasFileQuestions = exam.questions.some(q => getMode(q.id) === "upload");

      if (hasFileQuestions) {
        // Use multipart upload endpoint
        const formData = new FormData();
        formData.append("student_name", studentName);
        const orderedQids = exam.questions.map(q => q.id);
        formData.append("question_ids", orderedQids.join(","));
        for (const q of exam.questions) {
          const file = fileAnswers[q.id];
          if (file) {
            formData.append("files", file);
          } else {
            // Typed answer — create a text file from it
            const text = answers[q.id] || "(no answer)";
            const blob = new Blob([text], { type: "text/plain" });
            formData.append("files", blob, "answer.txt");
          }
        }
        const submission = await api.submitAnswersUpload(id, formData);
        router.push(`/submission/${submission.id}`);
      } else {
        const submission = await api.submitAnswers(id, {
          student_name: studentName,
          answers: exam.questions.map((q) => ({
            question_id: q.id,
            answer_text: answers[q.id] || "",
          })),
        });
        router.push(`/submission/${submission.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="card">
          <p className="text-red-400 mb-4">{error}</p>
          <a href="/" className="btn-secondary text-sm">← Back to Home</a>
        </div>
      </div>
    );
  }

  if (!exam) return null;

  const answeredCount = exam.questions.filter((q) => {
    if (getMode(q.id) === "upload") return !!fileAnswers[q.id];
    return answers[q.id]?.trim();
  }).length;
  const totalQ = exam.questions.length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Exam header */}
      <div className="card mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{exam.title}</h1>
            <p className="text-slate-400 text-sm">{exam.subject}</p>
            {exam.grading_mode === "course_material" && (
              <span className="inline-block mt-2 text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                📚 Graded from course material
              </span>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <span className="badge-blue">{exam.total_marks} marks total</span>
            <span className="badge-amber">{totalQ} questions</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student name */}
        <div className="card">
          <label className="label">Your Name</label>
          <input
            className="input"
            placeholder="Enter your full name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            required
          />
        </div>

        {/* Questions */}
        {exam.questions.map((q, i) => (
          <div key={q.id} className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                  Question {i + 1}
                </span>
                <p className="text-white mt-1 font-medium leading-relaxed">{q.question_text}</p>
              </div>
              <span className="badge-blue shrink-0">{q.max_marks} marks</span>
            </div>

            {/* Input mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode(q.id, "type")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  getMode(q.id) === "type"
                    ? "bg-brand-600 text-white"
                    : "bg-white/5 text-white/50 hover:text-white"
                }`}
              >
                ✍️ Type answer
              </button>
              <button
                type="button"
                onClick={() => setMode(q.id, "upload")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  getMode(q.id) === "upload"
                    ? "bg-violet-600 text-white"
                    : "bg-white/5 text-white/50 hover:text-white"
                }`}
              >
                📎 Upload photo/PDF
              </button>
            </div>

            {getMode(q.id) === "type" ? (
              <div>
                <label className="label">Your Answer</label>
                <textarea
                  className="input min-h-[120px] resize-y"
                  placeholder="Write your answer here..."
                  value={answers[q.id] || ""}
                  onChange={(e) => handleAnswer(q.id, e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="label">Upload Answer (photo of handwriting or PDF)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(q.id, file);
                  }}
                  className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:text-sm file:cursor-pointer hover:file:bg-violet-700"
                />
                {fileAnswers[q.id] && (
                  <p className="mt-2 text-emerald-400 text-xs">✓ {fileAnswers[q.id].name} — will be read via OCR</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Progress + submit */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-400">
              {answeredCount} of {totalQ} answered
            </span>
            <span className={answeredCount === totalQ ? "badge-green" : "badge-amber"}>
              {answeredCount === totalQ ? "All answered ✓" : "Some unanswered"}
            </span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-2 mb-6">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / totalQ) * 100}%` }}
            />
          </div>
          {error && (
            <div className="rounded-xl bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}
          <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base">
            {submitting ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Grading your exam... (may take ~30s)
              </span>
            ) : (
              "Submit and Get Results →"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
