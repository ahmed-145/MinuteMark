"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api, Exam, SubmissionSummary, ClassAnalytics } from "@/lib/api";
import Link from "next/link";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [examId, setExamId] = useState(searchParams.get("examId") || "");
  const [inputId, setInputId] = useState(searchParams.get("examId") || "");
  const [exam, setExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [view, setView] = useState<"submissions" | "analytics">("submissions");
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [e, subs, analyticData] = await Promise.all([
        api.getExam(id),
        api.getSubmissions(id),
        api.getAnalytics(id)
      ]);
      setExam(e);
      setSubmissions(subs);
      setAnalytics(analyticData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load exam");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    if (examId) load(examId);
  }, [examId, load, router]);

  const copyLink = () => {
    if (!exam) return;
    const url = `${window.location.origin}/exam/${exam.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!exam || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const res = await api.submitBatch(exam.id, file);
      setBatchMessage(`Accepted: detected ${res.students_detected} students. Grading started!`);
      setTimeout(() => load(exam.id), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Batch upload failed");
    } finally {
      setBatchLoading(false);
    }
  };

  const avg =
    submissions.length > 0
      ? (submissions.reduce((s, sub) => s + (sub.total_score || 0), 0) / submissions.length).toFixed(1)
      : null;

  const flaggedCount = submissions.filter(s => s.has_plagiarism_flag).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="page-header">MinuteMark Dashboard</h1>
        <p className="page-sub">View submissions, check grades, export results.</p>
      </div>

      {/* Exam ID input */}
      {!exam && (
        <div className="card mb-8">
          <h2 className="text-base font-semibold text-white mb-4">Load an Exam</h2>
          <div className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="Exam ID"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
            />
            <button
              onClick={() => setExamId(inputId)}
              disabled={loading}
              className="btn-primary"
            >
              Load
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            New here?{" "}
            <Link href="/create" className="text-brand-400 hover:underline">
              Create an exam →
            </Link>
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-900/30 border border-red-500/40 text-red-300 px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {exam && (
        <>
          {/* Exam info bar */}
          <div className="card mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{exam.title}</h2>
                <p className="text-slate-400 text-sm mt-1">{exam.subject} · {exam.total_marks} marks · {exam.questions.length} questions</p>
                <p className="text-slate-500 text-xs mt-1 font-mono">ID: {exam.id}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={copyLink} className="btn-secondary text-sm">
                  {copied ? "✓ Copied!" : "📋 Copy Student Link"}
                </button>
                
                <label className={`btn-secondary text-sm cursor-pointer ${batchLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                  {batchLoading ? "⌛ Processing Batch..." : "📦 Batch PDF Upload"}
                  <input type="file" className="hidden" accept=".pdf" onChange={handleBatchUpload} />
                </label>

                <div className="relative group">
                  <button className="btn-primary text-sm flex items-center gap-2">
                    ↓ Export Grades
                    <span className="text-[10px]">▼</span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl hidden group-hover:block z-20 overflow-hidden">
                    <a href={api.exportCsvUrl(exam.id)} className="block px-4 py-2.5 text-xs text-slate-300 hover:bg-brand-600 hover:text-white transition-colors" download>Standard CSV</a>
                    <a href={api.exportCanvasUrl(exam.id)} className="block px-4 py-2.5 text-xs text-slate-300 hover:bg-brand-600 hover:text-white transition-colors" download>Canvas Import</a>
                    <a href={api.exportMoodleUrl(exam.id)} className="block px-4 py-2.5 text-xs text-slate-300 hover:bg-brand-600 hover:text-white transition-colors" download>Moodle Import</a>
                  </div>
                </div>

                <button
                  onClick={() => { setExam(null); setSubmissions([]); setExamId(""); setInputId(""); }}
                  className="btn-secondary text-sm"
                >
                  Change Exam
                </button>
              </div>
            </div>
          </div>

          {/* Toast Notification for Batch */}
          {batchMessage && (
            <div className="fixed bottom-8 right-8 max-w-sm bg-brand-600 text-white p-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-start gap-4">
                <p className="text-sm font-medium">{batchMessage}</p>
                <button onClick={() => setBatchMessage(null)} className="text-white/50 hover:text-white">✕</button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Submissions", value: submissions.length, color: "" },
              { label: "Avg Score", value: avg ? `${avg} / ${exam.total_marks}` : "—", color: "" },
              { label: "Total Marks", value: exam.total_marks, color: "" },
              { label: "⚠️ Flagged", value: flaggedCount, color: flaggedCount > 0 ? "text-orange-400" : "" },
            ].map((stat) => (
              <div key={stat.label} className="card-solid text-center">
                <div className={`text-2xl font-bold ${stat.color || "text-white"}`}>{stat.value}</div>
                <div className="text-slate-400 text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* View Switcher */}
          <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
            <button
              onClick={() => setView("submissions")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === "submissions"
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📋 Submissions
            </button>
            <button
              onClick={() => setView("analytics")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === "analytics"
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📊 Class Analytics
            </button>
          </div>

          {/* Submissions list */}
          {view === "submissions" && (
            submissions.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-slate-400 mb-4">No submissions yet.</p>
                <p className="text-slate-500 text-sm">
                  Share this link with your students:
                </p>
                <p className="font-mono text-brand-400 text-sm mt-2 break-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/exam/${exam.id}` : `/exam/${exam.id}`}
                </p>
              </div>
            ) : (
              <div className="card overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-white/10">
                  <h3 className="font-semibold text-white text-sm">
                    All Submissions ({submissions.length})
                  </h3>
                </div>
                <div className="divide-y divide-white/5">
                  {submissions.map((sub) => {
                    const pct = exam.total_marks > 0 ? ((sub.total_score || 0) / exam.total_marks) * 100 : 0;
                    return (
                      <div key={sub.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">{sub.student_name}</p>
                            {sub.has_plagiarism_flag && (
                              <span className="inline-flex items-center gap-1 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded-full shrink-0">
                                ⚠️ Flagged
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 text-xs">
                            {new Date(sub.submitted_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <span className="font-bold text-white">{sub.total_score?.toFixed(1) ?? "—"}</span>
                            <span className="text-slate-400 text-sm"> / {exam.total_marks}</span>
                            <p className="text-xs text-slate-500">{pct.toFixed(0)}%</p>
                          </div>
                          <Link href={`/submission/${sub.id}`} className="btn-secondary text-xs px-3 py-1.5">
                            View →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Analytics View */}
          {view === "analytics" && analytics && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Score Distribution */}
                <div className="card">
                  <h3 className="text-sm font-semibold text-white mb-4">Score Distribution</h3>
                  <div className="space-y-3">
                    {Object.entries(analytics.score_distribution).map(([range, count]) => {
                      const pct = analytics.total_submissions > 0 ? (count / analytics.total_submissions) * 100 : 0;
                      return (
                        <div key={range}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">{range}</span>
                            <span className="text-white font-medium">{count} student(s)</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Class Average */}
                <div className="card flex flex-col items-center justify-center text-center">
                  <div className="text-slate-400 text-sm mb-2">Class Average Score</div>
                  <div className="text-5xl font-bold text-white mb-1">{analytics.average_pct}%</div>
                  <div className="text-slate-500 text-sm">{analytics.average_score} / {exam.total_marks} marks</div>
                  <div className="mt-6 flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${analytics.average_pct >= 70 ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                    <span className="text-slate-400">{analytics.average_pct >= 70 ? 'Performing well' : 'Needs attention'}</span>
                  </div>
                </div>
              </div>

              {/* Question Breakdown */}
              <div className="card overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-white/10">
                  <h3 className="font-semibold text-white text-sm">Question Performance</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {analytics.question_breakdown.map((q) => (
                    <div key={q.question_id} className="px-6 py-4">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <p className="text-white text-sm font-medium leading-relaxed">{q.question_text}</p>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold ${q.success_rate < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {q.success_rate}% success
                          </div>
                          <div className="text-xs text-slate-500">Avg: {q.avg_score}/{q.max_marks}</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${q.success_rate < 50 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${q.success_rate}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
