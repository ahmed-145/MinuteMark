import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GradeAI — AI-Powered Exam Grading",
  description:
    "Grades in 60 seconds, not 3 weeks. Instant, teacher-quality feedback for every exam submission.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        <nav className="border-b border-white/10 bg-black/20 backdrop-blur-lg sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-brand-900/50 group-hover:scale-105 transition-transform">
                G
              </div>
              <span className="font-bold text-lg text-white tracking-tight">GradeAI</span>
            </a>
            <div className="flex items-center gap-3">
              <a href="/create" className="btn-secondary text-sm px-4 py-2">
                Create Exam
              </a>
              <a href="/dashboard" className="btn-primary text-sm px-4 py-2">
                Dashboard
              </a>
            </div>
          </div>
        </nav>
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </body>
    </html>
  );
}
