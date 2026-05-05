"use client";

import { useState } from "react";
import Link from "next/link";
import { api, StudentProgress, SubjectPerformance, WeakArea, SubmissionBrief } from "@/lib/api";

export default function ProgressPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchProgress() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const data = await api.getStudentProgress(name.trim());
      setProgress(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("404") ? `No submissions found for "${name}"` : msg);
    } finally {
      setLoading(false);
    }
  }

  const scoreColor = (pct: number) =>
    pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-yellow-400" : "text-red-400";

  const scoreBarColor = (pct: number) =>
    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          GradeAI
        </Link>
        <Link href="/dashboard" className="text-sm text-white/60 hover:text-white transition-colors">
          Instructor Dashboard →
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Student Progress
          </h1>
          <p className="text-white/60">Track your performance across all exams and identify weak areas</p>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-12">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchProgress()}
            placeholder="Enter your name exactly as used in exams..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={fetchProgress}
            disabled={loading || !name.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold disabled:opacity-40 hover:opacity-90 transition-all"
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 mb-8 text-center">
            {error}
          </div>
        )}

        {progress && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-4xl font-bold text-violet-400 mb-1">{progress.total_submissions}</div>
                <div className="text-white/50 text-sm">Exams Taken</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <div className={`text-4xl font-bold mb-1 ${scoreColor(progress.average_score_pct)}`}>
                  {progress.average_score_pct}%
                </div>
                <div className="text-white/50 text-sm">Average Score</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-4xl font-bold text-orange-400 mb-1">{progress.weak_areas.length}</div>
                <div className="text-white/50 text-sm">Weak Areas</div>
              </div>
            </div>

            {/* Score History */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span className="text-xl">📈</span> Exam History
              </h2>
              <div className="space-y-3">
                {progress.submissions.map((sub: SubmissionBrief) => (
                  <div key={sub.submission_id} className="flex items-center gap-4">
                    <Link
                      href={`/submission/${sub.submission_id}`}
                      className="text-white/60 hover:text-white transition-colors text-sm w-48 truncate"
                    >
                      {sub.exam_title}
                    </Link>
                    <span className="text-white/40 text-xs">{sub.subject}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${scoreBarColor(sub.score_pct)} rounded-full transition-all`}
                        style={{ width: `${sub.score_pct}%` }}
                      />
                    </div>
                    <span className={`text-sm font-mono font-semibold w-14 text-right ${scoreColor(sub.score_pct)}`}>
                      {sub.score_pct}%
                    </span>
                    <span className="text-white/30 text-xs">
                      {new Date(sub.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subject Performance */}
            {progress.subject_performance.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">📚</span> Performance by Subject
                </h2>
                <div className="space-y-4">
                  {progress.subject_performance.map((s: SubjectPerformance) => (
                    <div key={s.subject}>
                      <div className="flex justify-between mb-1">
                        <span className="text-white/70">{s.subject}</span>
                        <span className={`font-semibold ${scoreColor(s.avg_score_pct)}`}>{s.avg_score_pct}%</span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${scoreBarColor(s.avg_score_pct)} rounded-full transition-all`}
                          style={{ width: `${s.avg_score_pct}%` }}
                        />
                      </div>
                      <div className="text-white/30 text-xs mt-1">{s.submission_count} exam(s)</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weak Areas */}
            {progress.weak_areas.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">🎯</span> Areas to Improve
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {progress.weak_areas.map((area: WeakArea, i: number) => (
                    <div key={i} className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-orange-300">{area.topic}</div>
                        <div className="text-orange-400 font-mono text-sm">{area.avg_score_pct.toFixed(0)}%</div>
                      </div>
                      <div className="text-white/40 text-xs mb-2">{area.question_count} question(s)</div>
                      {area.tip && (
                        <div className="text-white/60 text-sm border-t border-white/10 pt-2 mt-2">
                          💡 {area.tip}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No weak areas */}
            {progress.weak_areas.length === 0 && progress.average_score_pct >= 80 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <div className="text-emerald-400 font-semibold">Great work! No significant weak areas detected.</div>
                <div className="text-white/50 text-sm mt-1">Keep it up!</div>
              </div>
            )}
          </div>
        )}

        {!progress && !loading && !error && (
          <div className="text-center text-white/30 mt-20">
            <div className="text-6xl mb-4">📊</div>
            <div>Enter your name above to view your progress</div>
          </div>
        )}
      </div>
    </div>
  );
}
