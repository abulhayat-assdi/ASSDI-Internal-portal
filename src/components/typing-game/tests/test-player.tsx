"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Award, RotateCcw } from "lucide-react";
import ExamRunner, { type ExamRunnerSubmitPayload } from "@/components/typing-exam/ExamRunner";

interface Result {
  sessionId: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctChars: number;
  totalChars: number;
  timeMs: number;
  xp: number;
}

const BASE = "/student-dashboard/typing-game/tests";

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Opens a server session, runs the shared exam runner, shows the server-graded result. */
export function TestPlayer({ testId, lang, title }: { testId: string; lang: "en" | "bn"; title: string }) {
  const [run, setRun] = useState<{ sessionId: string; text: string; seconds: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setRun(null);
    setResult(null);
    setError("");
    fetch("/api/typing-game/tests/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, lang }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? String(r.status));
        if (alive) setRun(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "ERROR");
      });
    return () => {
      alive = false;
    };
  }, [testId, lang, attempt]);

  const submit = useCallback(
    async (payload: ExamRunnerSubmitPayload) => {
      if (!run) return;
      setSubmitting(true);
      try {
        const r = await fetch(`/api/typing-game/tests/${run.sessionId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? String(r.status));
        setResult(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ERROR");
      } finally {
        setSubmitting(false);
      }
    },
    [run],
  );

  if (error) {
    return (
      <div className="tap-card mx-auto max-w-md p-6 text-center">
        <p className="font-semibold">টেস্ট চালানো যায়নি ({error})।</p>
        <button type="button" className="tap-btn tap-btn-primary tap-btn-sm mt-3" onClick={() => setAttempt((a) => a + 1)}>
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="tap-card mx-auto flex max-w-xl flex-col items-center gap-4 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
        <div className="flex items-end gap-8">
          <div>
            <p className="text-xs uppercase text-ink-faint">Speed</p>
            <p className="font-display text-5xl font-extrabold tabular-nums" style={{ color: "var(--tap-primary-600)" }}>
              {Math.round(result.wpm)}
              <span className="ml-1 text-base">wpm</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-ink-faint">Accuracy</p>
            <p className="font-display text-5xl font-extrabold tabular-nums">{Math.round(result.accuracy)}%</p>
          </div>
        </div>
        <p className="text-sm text-ink-muted">
          Raw {Math.round(result.rawWpm)} wpm · Characters {result.correctChars}/{result.totalChars} · Time {fmt(result.timeMs)}
        </p>
        {result.xp > 0 ? <span className="tap-badge tap-badge-legendary">+{result.xp} XP</span> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`${BASE}/certificate/${result.sessionId}`} className="tap-btn tap-btn-primary tap-btn-md">
            <Award className="h-4 w-4" aria-hidden="true" /> সার্টিফিকেট
          </Link>
          <button type="button" className="tap-btn tap-btn-secondary tap-btn-md" onClick={() => setAttempt((a) => a + 1)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> আবার দিন
          </button>
          <Link href={`${BASE}?lang=${lang}`} className="tap-btn tap-btn-ghost tap-btn-md">
            সব টেস্ট
          </Link>
        </div>
      </div>
    );
  }

  if (!run) return <div className="tap-skeleton mx-auto h-48 max-w-xl rounded-2xl" />;

  return <ExamRunner key={run.sessionId} examText={run.text} durationSeconds={run.seconds} onSubmit={submit} submitting={submitting} />;
}
