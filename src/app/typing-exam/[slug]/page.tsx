"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ExamRunner from "@/components/typing-exam/ExamRunner";
import ExamResultPanel from "@/components/typing-exam/ExamResultPanel";

type Stage = "loading" | "not_found" | "not_active" | "identity" | "running" | "result";

type Meta = { title: string; description: string; durationSeconds: number };
type ExamData = { examId: string; examText: string; durationSeconds: number; title: string };
type ResultData = { wpm: number; accuracy: number; result: "PASS" | "AVERAGE" | "FAIL" };

const input =
  "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-300";
const label = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center border border-slate-100">
        {children}
      </div>
    </div>
  );
}

export default function PublicTypingExamPage() {
  const { slug } = useParams<{ slug: string }>();

  const [stage, setStage] = useState<Stage>("loading");
  const [meta, setMeta] = useState<Meta | null>(null);

  const [name, setName] = useState("");
  const [roll, setRoll] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState("");

  const [examData, setExamData] = useState<ExamData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultData, setResultData] = useState<ResultData | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/typing-exam/public/${slug}/check`)
      .then(async (r) => {
        if (r.status === 404) {
          setStage("not_found");
          return;
        }
        if (!r.ok) {
          setStage("not_active");
          return;
        }
        const d = await r.json();
        setMeta(d);
        setStage("identity");
      })
      .catch(() => setStage("not_active"));
  }, [slug]);

  async function submitIdentity(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setChecking(true);
    try {
      const res = await fetch(`/api/typing-exam/public/${slug}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, roll, phone, password: password || undefined }),
      });
      if (res.status === 401) {
        const d = await res.json().catch(() => ({}));
        if (d.needsPassword) {
          setNeedsPassword(true);
          setFormError(
            password
              ? "পাসওয়ার্ডটি সঠিক নয়। আবার চেষ্টা করুন।"
              : "আপনি ইতিমধ্যে এই পরীক্ষা দিয়েছেন। আবার দিতে চাইলে পাসওয়ার্ড দিন।"
          );
          return;
        }
      }
      if (res.status === 404) {
        setStage("not_found");
        return;
      }
      if (res.status === 403) {
        setStage("not_active");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFormError(d.error || "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        return;
      }
      const d = await res.json();
      setExamData(d);
      setStage("running");
    } catch {
      setFormError("সার্ভারে সংযোগ করতে পারা যাচ্ছে না।");
    } finally {
      setChecking(false);
    }
  }

  async function submitAttempt(payload: { typedText: string; elapsedSeconds: number }) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/typing-exam/public/${slug}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          roll,
          phone,
          password: password || undefined,
          typedText: payload.typedText,
          elapsedSeconds: payload.elapsedSeconds,
        }),
      });
      if (res.status === 401) {
        // Retry password expired/rejected mid-flow (unlikely, but handle gracefully) —
        // send them back to the identity step to re-authenticate.
        setNeedsPassword(true);
        setFormError("আপনি ইতিমধ্যে এই পরীক্ষা দিয়েছেন। আবার দিতে চাইলে পাসওয়ার্ড দিন।");
        setStage("identity");
        return;
      }
      if (!res.ok) {
        setFormError("জমা দেওয়ার সময় একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        setStage("identity");
        return;
      }
      const d = await res.json();
      setResultData(d);
      setStage("result");
    } catch {
      setFormError("সার্ভারে সংযোগ করতে পারা যাচ্ছে না।");
      setStage("identity");
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (stage === "not_found") {
    return (
      <Centered>
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="no-gradient text-lg font-bold text-slate-700 mb-1">লিংকটি সঠিক নয়</p>
        <p className="text-slate-400 text-sm">এই ঠিকানায় কোনো পরীক্ষা পাওয়া যায়নি।</p>
      </Centered>
    );
  }

  if (stage === "not_active") {
    return (
      <Centered>
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="no-gradient text-lg font-bold text-slate-700 mb-1">পরীক্ষাটি এখন চলমান নেই</p>
        <p className="text-slate-400 text-sm">এই মুহূর্তে এই পরীক্ষা দেওয়া যাচ্ছে না। পরে আবার চেষ্টা করুন।</p>
      </Centered>
    );
  }

  if (stage === "result" && resultData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="max-w-md w-full space-y-4">
          <ExamResultPanel result={resultData} variant="public" displayName={name} />
          <p className="text-center text-slate-400 text-xs">
            আপনার পরীক্ষা সফলভাবে জমা হয়েছে। এই পাতাটি বন্ধ করে দিতে পারেন।
          </p>
        </div>
      </div>
    );
  }

  // identity + running stages share the header (exam title/description stays visible)
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-[#0f2744]">
        <div className="max-w-2xl mx-auto px-5 py-8 text-center">
          <p className="no-gradient text-blue-400 text-[11px] font-bold uppercase tracking-[0.2em] mb-2">
            Typing Test Exam
          </p>
          <p className="no-gradient text-white text-2xl sm:text-3xl font-extrabold leading-tight">
            {meta?.title || examData?.title || "টাইপিং পরীক্ষা"}
          </p>
          {meta?.description && (
            <p className="no-gradient text-slate-300 text-sm mt-2 max-w-lg mx-auto">{meta.description}</p>
          )}
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-[#0f2744] via-blue-500 to-[#0f2744]" />

      <div className="max-w-md mx-auto px-4 py-8">
        {stage === "identity" && (
          <form onSubmit={submitIdentity} className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div>
              <label className={label}>নাম</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={input}
                placeholder="আপনার পূর্ণ নাম"
              />
            </div>
            <div>
              <label className={label}>রোল / আইডি</label>
              <input
                type="text"
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                required
                className={input}
                placeholder="রোল বা আইডি নম্বর"
              />
            </div>
            <div>
              <label className={label}>মোবাইল নম্বর</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className={input}
                placeholder="01XXXXXXXXX"
              />
            </div>
            {needsPassword && (
              <div>
                <label className={label}>পাসওয়ার্ড</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={input}
                  placeholder="পুনরায় পরীক্ষা দেওয়ার পাসওয়ার্ড"
                />
              </div>
            )}

            {formError && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-700 text-sm">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={checking}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition-colors shadow-md shadow-blue-900/10 flex items-center justify-center gap-2"
            >
              {checking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  যাচাই করা হচ্ছে...
                </>
              ) : (
                "শুরু করুন"
              )}
            </button>
          </form>
        )}

        {stage === "running" && examData && (
          <ExamRunner
            examText={examData.examText}
            durationSeconds={examData.durationSeconds}
            onSubmit={submitAttempt}
            submitting={submitting}
          />
        )}

        <p className="text-center text-slate-400 text-xs pt-8 pb-2">
          Sales &amp; Marketing Institute &bull; Typing Test Exam
        </p>
      </div>
    </div>
  );
}
