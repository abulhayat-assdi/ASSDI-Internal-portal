"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Timer, Zap, Target } from "lucide-react";
import { scoreAttempt } from "@/lib/typing-exam/scoring";
import { GLASS_PANEL } from "@/components/typing-exam/ui";
import ExamReadyScreen from "@/components/typing-exam/ExamReadyScreen";
import ExamCountdown from "@/components/typing-exam/ExamCountdown";
import ExamFullscreenBanner from "@/components/typing-exam/ExamFullscreenBanner";
import TypingField from "@/components/typing-exam/TypingField";

type Phase = "ready" | "countdown" | "running" | "finished";

export interface ExamRunnerSubmitPayload {
  typedText: string;
  elapsedSeconds: number;
  /**
   * Present only when the taker went through the ready-screen retry-password
   * gate (attemptsUsed > 0) and it verified. ExamRunner itself stays
   * taker-type-agnostic (STUDENT vs PUBLIC) — it just forwards whatever
   * password the ready screen collected; the calling page decides how (or
   * whether) to include it in its own `/attempt` POST body. Purely
   * additive to the payload shape — existing call sites that only read
   * `typedText`/`elapsedSeconds` are unaffected.
   */
  retryPassword?: string;
}

export interface ExamRunnerProps {
  examText: string;
  durationSeconds: number;
  onSubmit: (payload: ExamRunnerSubmitPayload) => void | Promise<void>;
  submitting?: boolean;
  /** Number of prior attempts by this taker. >0 shows the retry-password gate on the ready screen. */
  attemptsUsed?: number;
  /** Verifies a retry password against the server; resolve `true`/`false`. Required only when `attemptsUsed` can be > 0. */
  onVerifyRetryPassword?: (password: string) => Promise<boolean>;
}

/**
 * Shared typing-exam taking UI. Phases: "ready" (explains flow, requests
 * fullscreen + retry-password gate) -> "countdown" (3-2-1-go overlay) ->
 * "running" (timer + Monkeytype-style passage + live WPM/accuracy preview)
 * -> "finished" (brief loading state while the async onSubmit resolves).
 * The authoritative score is always recomputed server-side from the
 * submitted typedText + elapsedSeconds — this component's live numbers are
 * UX only. Deliberately does NOT render the graded result itself — the
 * calling page receives the payload via onSubmit, awaits its own API call,
 * and renders <ExamResultPanel> with the real server-graded response once
 * it has it (see ExamResultPanel.tsx).
 */
export default function ExamRunner({
  examText,
  durationSeconds,
  onSubmit,
  submitting,
  attemptsUsed,
  onVerifyRetryPassword,
}: ExamRunnerProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [typedText, setTypedText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const startedAtRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const pendingRetryPasswordRef = useRef<string | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const requestFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) {
      // iOS Safari etc. may not support it — proceed without fullscreen.
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const finish = useCallback(
    (finalTypedText: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setPhase("finished");
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      const elapsed = startedAtRef.current
        ? Math.min(durationSeconds, Math.round((Date.now() - startedAtRef.current) / 1000))
        : durationSeconds;
      onSubmit({
        typedText: finalTypedText,
        elapsedSeconds: Math.max(elapsed, 1),
        ...(pendingRetryPasswordRef.current ? { retryPassword: pendingRetryPasswordRef.current } : {}),
      });
    },
    [durationSeconds, onSubmit]
  );

  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          finish(typedText);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, finish]);

  const handleReadyStart = useCallback(
    (retryPassword?: string) => {
      pendingRetryPasswordRef.current = retryPassword;
      submittedRef.current = false;
      setTypedText("");
      setSecondsLeft(durationSeconds);
      setPhase("countdown");
    },
    [durationSeconds]
  );

  const handleCountdownComplete = useCallback(() => {
    startedAtRef.current = Date.now();
    setPhase("running");
  }, []);

  const handleChange = (value: string) => {
    setTypedText(value);
    if (value.length >= examText.length) {
      finish(value);
    }
  };

  const live = useMemo(() => {
    const elapsed = startedAtRef.current
      ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 1;
    return scoreAttempt({ originalText: examText, typedText, elapsedSeconds: elapsed });
  }, [examText, typedText]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const timeUrgent = secondsLeft <= 10 && phase === "running";
  const timeProgress = Math.max(0, Math.min(100, (secondsLeft / durationSeconds) * 100));

  return (
    <div ref={containerRef} className="relative">
      <AnimatePresence mode="wait">
        {phase === "ready" && (
          <motion.div key="ready" exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}>
            <ExamReadyScreen
              durationSeconds={durationSeconds}
              attemptsUsed={attemptsUsed}
              onVerifyRetryPassword={onVerifyRetryPassword}
              requestFullscreen={requestFullscreen}
              onStart={handleReadyStart}
            />
          </motion.div>
        )}

        {(phase === "countdown" || phase === "running") && (
          <motion.div
            key="exam"
            initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className={`${GLASS_PANEL} rounded-2xl px-5 py-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <motion.div
                  className={`flex items-center gap-2 text-2xl font-bold tabular-nums ${timeUrgent ? "text-red-600" : "text-slate-800"}`}
                  animate={timeUrgent && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.6, repeat: timeUrgent && !reduceMotion ? Infinity : 0 }}
                >
                  <Timer className="h-5 w-5" strokeWidth={2} />
                  {minutes}:{seconds}
                </motion.div>
                <div className="flex gap-3 text-sm">
                  <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                    <Zap className="h-3.5 w-3.5" strokeWidth={2.25} />
                    WPM <strong className="tabular-nums">{live.wpm}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                    <Target className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Accuracy <strong className="tabular-nums">{live.accuracy}%</strong>
                  </span>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className={`h-full rounded-full ${timeUrgent ? "bg-red-500" : "bg-brand-500"}`}
                  animate={{ width: `${timeProgress}%` }}
                  transition={{ duration: 0.5, ease: "linear" }}
                />
              </div>
            </div>

            <AnimatePresence>
              {phase === "running" && !isFullscreen && <ExamFullscreenBanner onReenter={requestFullscreen} />}
            </AnimatePresence>

            <TypingField
              examText={examText}
              typedText={typedText}
              onChange={handleChange}
              disabled={phase !== "running" || submitting}
            />

            <motion.button
              onClick={() => finish(typedText)}
              disabled={phase !== "running" || submitting}
              whileHover={reduceMotion || submitting ? undefined : { scale: 1.02 }}
              whileTap={reduceMotion || submitting ? undefined : { scale: 0.98 }}
              className="cursor-pointer rounded-xl bg-slate-800 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "জমা হচ্ছে..." : "জমা দিন"}
            </motion.button>
          </motion.div>
        )}

        {phase === "finished" && (
          <motion.div
            key="finished"
            initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`${GLASS_PANEL} rounded-2xl p-8 text-center`}
          >
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-3 text-sm text-slate-500">জমা হচ্ছে...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "countdown" && <ExamCountdown onComplete={handleCountdownComplete} />}
    </div>
  );
}
