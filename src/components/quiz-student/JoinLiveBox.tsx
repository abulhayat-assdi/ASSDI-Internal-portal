"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, ArrowRight, Loader2 } from "lucide-react";
import { quizErrorMessage } from "./shared";

/** Prominent "enter the 6-digit code" box for hosted live quizzes. */
export default function JoinLiveBox() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("৬ সংখ্যার কোডটি লিখুন।");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/student/quiz/live/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sessionId) {
        setError(quizErrorMessage(data.error));
        setBusy(false);
        return;
      }
      router.push(`/student-dashboard/quiz/live/${data.sessionId}`);
    } catch {
      setError("সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={join}
      className="rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-5 sm:p-6 text-white shadow-lg shadow-brand-600/20"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Radio className="h-4 w-4" strokeWidth={2.5} />
        লাইভ কুইজে যোগ দিন
      </div>
      <p className="text-white/80 text-sm mt-1">শিক্ষকের দেওয়া ৬ সংখ্যার কোড লিখুন।</p>
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <input
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            setError(null);
          }}
          placeholder="000000"
          aria-label="Live quiz code"
          className="flex-1 rounded-xl bg-white/95 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-slate-800 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-white/40"
        />
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed hover:bg-slate-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          যোগ দিন
          {!busy && <ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
