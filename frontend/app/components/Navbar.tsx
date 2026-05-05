"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [isAuth, setIsAuth] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuth(!!token);
  }, [pathname]);

  return (
    <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-brand-900/50 group-hover:scale-105 transition-transform">
            M
          </div>
          <span className="font-bold text-lg text-white tracking-tight">MinuteMark</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {isAuth ? (
            <>
              <Link href="/create" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Create Exam</Link>
              <Link href="/dashboard" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Dashboard</Link>
              <button 
                onClick={() => api.logout()}
                className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Login</Link>
              <Link href="/register" className="btn-primary text-xs px-4 py-2">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
