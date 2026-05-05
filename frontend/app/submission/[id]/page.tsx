"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Submission, Answer } from "@/lib/api";
import Link from "next/link";

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return <span className="badge-green">AI confidence: {pct}%</span>;
  if (pct >= 60) return <span className="badge-amber">AI confidence: {pct}%</span>;
  return <span className="badge-red">Low confidence: {pct}% — review suggested</span>;
}

function OverridePanel({
  answer,
  maxMarks,
  onOverride,
}: {
  answer: Answer;
  maxMarks: number;
  onOverride: (answerId: string, score: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(answer.final_score ?? ""));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = parseFloat(value);
    if (isNaN(n)) return;
    setSaving(true);
    await onOverride(answer.id, n);
    setSaving(false);
    setEditing(false);
  };

  return editing ? (
    <div className="flex items-center gap-2 mt-3">
      <input
        type="number"
        step="0.5"
        min={0}
        max={maxMarks}
        className="input w-24 py-1.5 px-3 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        onClick={save}
        disabled={saving}
        className="btn-primary text-xs px-3 py-1.5"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-3 py-1.5">
        Cancel
      </button>
    </div>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="btn-danger mt-3"
    >
      ✏️ Override Score
    </button>
  );
}

export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Map of question_id → max_marks (loaded from exam)
  const [maxMarkMap, setMaxMarkMap] = useState<Record<string, number>>({});

  useEffect(() => {
    api
      .getSubmission(id)
      .then(async (sub) => {
        setSubmission(sub);
        // Load exam to get max marks per question
        try {
          const exam = await api.getExam(sub.exam_id);
          const m: Record<string, number> = {};
          exam.questions.forEach((q) => { m[q.id] = q.max_marks; });
          setMaxMarkMap(m);
        } catch {
          // non-fatal
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load submission")
      )
      .finally(() => setLoading(false));
  }, [id]);

  const handleOverride = async (answerId: string, score: number) => {
    const updated = await api.overrideScore(answerId, score);
    setSubmission((prev) => {
      if (!prev) return prev;
      const newAnswers = prev.answers.map((a) => (a.id === answerId ? updated : a));
      const newTotal = newAnswers.reduce((s, a) => s + (a.final_score || 0), 0);
      return { ...prev, answers: newAnswers, total_score: newTotal };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="card">
          <p className="text-red-400 mb-4">{error ?? "Submission not found"}</p>
          <Link href="/dashboard" className="btn-secondary text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const totalMarks = Object.values(maxMarkMap).reduce((s, v) => s + v, 0);
  const pct = totalMarks > 0 ? ((submission.total_score || 0) / totalMarks) * 100 : 0;
  const gradeLabel = pct >= 90 ? "Excellent" : pct >= 75 ? "Good" : pct >= 60 ? "Satisfactory" : pct >= 50 ? "Pass" : "Needs Improvement";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors text-sm">
          ← Dashboard
        </Link>
      </div>

      {/* Score card */}
      <div className="card mb-8 text-center">
        <p className="text-slate-400 text-sm mb-1">{submission.student_name}</p>
        <div className="text-6xl font-bold text-white mb-2">
          {submission.total_score?.toFixed(1) ?? "—"}
        </div>
        <p className="text-slate-400 text-sm mb-4">out of {totalMarks > 0 ? totalMarks : "?"} marks</p>

        {/* Score bar */}
        <div className="w-full max-w-xs mx-auto bg-slate-700/50 rounded-full h-3 mb-4">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={
            pct >= 75 ? "badge-green text-sm" : pct >= 50 ? "badge-amber text-sm" : "badge-red text-sm"
          }
        >
          {gradeLabel} — {pct.toFixed(0)}%
        </span>
        <p className="text-slate-500 text-xs mt-4">
          Submitted {new Date(submission.submitted_at).toLocaleString()}
        </p>
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-5">
        {submission.answers.map((ans, i) => {
          const max = maxMarkMap[ans.question_id] ?? "?";
          const hasOverride = ans.instructor_score !== null;
          return (
            <div key={ans.id} className="card space-y-4">
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider shrink-0">
                  Q{i + 1}
                </span>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {hasOverride && <span className="badge-amber text-xs">Overridden</span>}
                  {ans.plagiarism_flagged && (
                    <span className="inline-flex items-center gap-1 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                      ⚠️ Similarity Warning
                      {ans.plagiarism_score != null && (
                        <span className="text-orange-400/70">({Math.round(ans.plagiarism_score * 100)}%)</span>
                      )}
                    </span>
                  )}
                  <ConfidenceBadge confidence={ans.ai_confidence} />
                  <span className="font-bold text-white">
                    {ans.final_score?.toFixed(1) ?? "—"} / {max}
                  </span>
                </div>
              </div>

              {/* Student answer */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Student&apos;s Answer</p>
                <p className="text-slate-300 text-sm leading-relaxed bg-slate-900/40 rounded-lg p-3">
                  {ans.answer_text}
                </p>
              </div>

              {/* AI feedback */}
              {ans.ai_feedback && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">AI Feedback</p>
                  <p className="text-slate-200 text-sm leading-relaxed bg-brand-900/20 border border-brand-500/20 rounded-lg p-3">
                    {ans.ai_feedback}
                  </p>
                </div>
              )}

              {/* Score comparison */}
              {hasOverride && (
                <div className="flex gap-3 text-xs">
                  <span className="text-slate-500">AI score: {ans.ai_score?.toFixed(1)}</span>
                  <span className="text-amber-400">Instructor override: {ans.instructor_score?.toFixed(1)}</span>
                </div>
              )}

              {/* Override control */}
              <OverridePanel answer={ans} maxMarks={Number(max)} onOverride={handleOverride} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
