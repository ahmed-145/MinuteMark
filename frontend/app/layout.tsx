import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata: Metadata = {
  title: "MinuteMark — AI-Powered Exam Grading",
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
        <Navbar />
        <main className="min-h-[calc(100vh-10rem)]">{children}</main>
        <footer className="py-8 border-t border-white/5 text-center text-slate-500 text-xs">
          © 2026 MinuteMark. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
