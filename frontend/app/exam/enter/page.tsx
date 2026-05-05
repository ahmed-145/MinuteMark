"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExamEnterPage() {
  const [examId, setExamId] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = examId.trim();
    if (id) router.push(`/exam/${id}`);
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-24">
      <div className="card text-center">
        <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Open Your Exam</h1>
        <p className="text-slate-400 mb-8 text-sm">Enter the exam ID your instructor shared with you</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input text-center"
            placeholder="Exam ID"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary w-full justify-center">
            Open Exam →
          </button>
        </form>
      </div>
    </div>
  );
}
