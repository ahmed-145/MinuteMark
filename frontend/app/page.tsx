export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
      {/* Hero */}
      <div className="text-center mb-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600/20 border border-brand-500/30 rounded-full text-brand-300 text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse"></span>
          AI-Powered Exam Grading
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
          Grades in{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">
            60 seconds.
          </span>
          <br />
          Not 3 weeks.
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          MinuteMark grades every exam submission with detailed, teacher-quality written feedback — per question, instantly, at scale.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <a href="/register" className="btn-primary px-8 py-4 text-base">
            Start Free Trial →
          </a>
          <a href="/login" className="btn-secondary px-8 py-4 text-base">
            Login
          </a>
        </div>
      </div>

      {/* Role cards */}
      <div className="grid sm:grid-cols-2 gap-6 mb-20">
        <div className="card group hover:border-brand-500/40 transition-colors duration-200">
          <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-600/30 transition-colors">
            <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">I&apos;m an Instructor</h2>
          <p className="text-slate-400 text-sm mb-5 leading-relaxed">
            Create an exam, set your answer key or rubric, share the link — AI grades every submission instantly with detailed feedback.
          </p>
          <a href="/create" className="btn-primary text-sm w-full justify-center">
            Create Exam
          </a>
        </div>

        <div className="card group hover:border-emerald-500/40 transition-colors duration-200">
          <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-600/30 transition-colors">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">I&apos;m a Student</h2>
          <p className="text-slate-400 text-sm mb-5 leading-relaxed">
            Got an exam link from your instructor? Open it and submit your answers — you&apos;ll see your results and detailed feedback immediately.
          </p>
          <a href="/exam/enter" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all w-full text-sm">
            Open My Exam
          </a>
        </div>
      </div>

      {/* Features grid */}
      <div className="grid sm:grid-cols-3 gap-6">
        {[
          { icon: "⚡", title: "Instant grading", desc: "From submit to results in under 60 seconds." },
          { icon: "📝", title: "Real feedback", desc: "3–6 sentences per question, like a real teacher wrote it." },
          { icon: "🌍", title: "Arabic support", desc: "Full Arabic exam grading with feedback in فصحى." },
          { icon: "🔒", title: "FERPA-compliant", desc: "No student data sent to ChatGPT or used for training." },
          { icon: "✏️", title: "Instructor override", desc: "Review any AI grade and change it in one click." },
          { icon: "📊", title: "CSV export", desc: "Download all grades to Excel or push to your LMS." },
        ].map((f) => (
          <div key={f.title} className="card-solid hover:bg-slate-700/60 transition-colors">
            <div className="text-2xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-white mb-1">{f.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
