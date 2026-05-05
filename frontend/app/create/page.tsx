"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface QuestionForm {
  question_text: string;
  max_marks: number;
  answer_key: string;
  rubric: string;
}

type GradingMode = "answer_key" | "rubric" | "course_material";

export default function CreateExamPage() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradingMode, setGradingMode] = useState<GradingMode>("answer_key");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { question_text: "", max_marks: 10, answer_key: "", rubric: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMarks = questions.reduce((s, q) => s + (q.max_marks || 0), 0);

  const addQuestion = () =>
    setQuestions((prev) => [...prev, { question_text: "", max_marks: 10, answer_key: "", rubric: "" }]);

  const removeQuestion = (i: number) =>
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));

  const updateQuestion = (i: number, field: keyof QuestionForm, value: string | number) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, [field]: value } : q)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const examPayload = {
        title,
        subject,
        total_marks: totalMarks,
        grading_mode: gradingMode,
        questions: questions.map((q, i) => ({
          question_text: q.question_text,
          max_marks: q.max_marks,
          answer_key: gradingMode === "answer_key" ? q.answer_key : null,
          rubric: gradingMode === "rubric" ? q.rubric : null,
          order_index: i,
        })),
      };

      let exam;
      if (gradingMode === "course_material" && materialFile) {
        const formData = new FormData();
        formData.append("exam_json", JSON.stringify(examPayload));
        formData.append("material_file", materialFile);
        exam = await api.createExamWithMaterial(formData);
      } else {
        exam = await api.createExam(examPayload);
      }
      router.push(`/dashboard?examId=${exam.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create exam");
    } finally {
      setLoading(false);
    }
  };

  const modeDescriptions: Record<GradingMode, string> = {
    answer_key: "You provide the correct answer — AI grades by comparison",
    rubric: "You describe the criteria — AI grades against your description",
    course_material: "Upload your course notes/textbook — AI infers correct answers from them",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="page-header">Create MinuteMark Exam</h1>
        <p className="page-sub">Set up your exam and grading criteria — students submit via shareable link.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Exam details */}
        <div className="card space-y-5">
          <h2 className="text-lg font-semibold text-white">Exam Details</h2>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="e.g. Midterm Exam — Biology 101"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              placeholder="e.g. Biology"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Grading Mode</label>
            <div className="grid gap-3 mt-2">
              {(["answer_key", "rubric", "course_material"] as GradingMode[]).map((mode) => (
                <label
                  key={mode}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    gradingMode === mode
                      ? "border-violet-500/60 bg-violet-500/10"
                      : "border-white/10 bg-white/3 hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="gradingMode"
                    value={mode}
                    checked={gradingMode === mode}
                    onChange={() => setGradingMode(mode)}
                    className="mt-0.5 accent-violet-500"
                  />
                  <div>
                    <div className="font-medium text-white capitalize flex items-center gap-2">
                      {mode === "answer_key" && "📝 Answer Key"}
                      {mode === "rubric" && "📋 Rubric"}
                      {mode === "course_material" && (
                        <span className="flex items-center gap-1.5">
                          📚 Course Material
                          <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-normal">
                            NEW
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-white/50 mt-0.5">{modeDescriptions[mode]}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Course material file upload */}
            {gradingMode === "course_material" && (
              <div className="mt-4 p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl">
                <label className="label text-violet-300">Upload Course Material</label>
                <p className="text-white/40 text-xs mb-3">
                  PDF, image, or text file. The AI will read it and infer correct answers for every question.
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.txt,.webp"
                  onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:text-sm file:cursor-pointer hover:file:bg-violet-700"
                  required={gradingMode === "course_material"}
                />
                {materialFile && (
                  <p className="mt-2 text-emerald-400 text-xs">✓ {materialFile.name} selected</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Questions <span className="text-slate-400 text-base font-normal">({questions.length})</span>
            </h2>
            <span className="badge-blue">Total: {totalMarks} marks</span>
          </div>

          {questions.map((q, i) => (
            <div key={i} className="card space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-400">Question {i + 1}</span>
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(i)} className="btn-danger">
                    Remove
                  </button>
                )}
              </div>
              <div>
                <label className="label">Question Text</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  placeholder="Enter the question..."
                  value={q.question_text}
                  onChange={(e) => updateQuestion(i, "question_text", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Max Marks</label>
                <input
                  type="number"
                  className="input w-32"
                  min={1}
                  value={q.max_marks}
                  onChange={(e) => updateQuestion(i, "max_marks", parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              {gradingMode === "answer_key" && (
                <div>
                  <label className="label">Answer Key</label>
                  <textarea
                    className="input min-h-[80px] resize-y"
                    placeholder="The correct answer..."
                    value={q.answer_key}
                    onChange={(e) => updateQuestion(i, "answer_key", e.target.value)}
                    required
                  />
                </div>
              )}
              {gradingMode === "rubric" && (
                <div>
                  <label className="label">Grading Rubric</label>
                  <textarea
                    className="input min-h-[80px] resize-y"
                    placeholder="Describe what a full-marks answer should include..."
                    value={q.rubric}
                    onChange={(e) => updateQuestion(i, "rubric", e.target.value)}
                    required
                  />
                </div>
              )}
              {gradingMode === "course_material" && (
                <div className="text-white/40 text-sm bg-violet-500/5 border border-violet-500/15 rounded-lg p-3">
                  📚 This question will be graded automatically from your course material — no answer key needed.
                </div>
              )}
            </div>
          ))}

          <button type="button" onClick={addQuestion} className="btn-secondary w-full">
            + Add Question
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {gradingMode === "course_material" ? "Uploading & Processing Material..." : "Creating Exam..."}
            </span>
          ) : (
            "Create Exam & Get Link →"
          )}
        </button>
      </form>
    </div>
  );
}
