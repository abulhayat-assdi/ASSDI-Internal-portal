"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Timer, Zap, Target, Percent } from "lucide-react";
import { scoreAttempt } from "@/lib/typing-exam/scoring";
import { GLASS_PANEL, StatPill } from "@/components/typing-exam/ui";
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
    // No early submit: reaching the end of the passage no longer
    // auto-finishes the attempt (nor is there a manual submit button —
    // see the "running" phase JSX below). Only the countdown timer hitting
    // 0 calls finish(). Clamp at examText.length purely so the value can't
    // grow unbounded once there's nothing left to compare against —
    // backspacing/retyping within that bound to fix mistakes while waiting
    // for time to run out is still fully allowed.
    setTypedText(value.length > examText.length ? value.slice(0, examText.length) : value);
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
  const charProgress = examText.length > 0 ? Math.round((typedText.length / examText.length) * 100) : 0;

  // While the browser has this container as the fullscreen element, own the
  // whole viewport with a solid light background and center everything —
  // without this, the fullscreened box (which is only as tall as its own
  // content) leaves the browser's default black ::backdrop showing through
  // above/below it, and nothing recenters the content for the new size.
  const rootClass = isFullscreen
    ? "fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-white via-slate-50 to-white px-4 py-10 sm:px-8"
    : "relative";
  const phaseWrapClass = isFullscreen ? "w-full max-w-4xl" : "";

  return (
    <div ref={containerRef} className={rootClass}>
      <div className={phaseWrapClass}>
        <AnimatePresence mode="wait">
          {phase === "ready" && (
            <motion.div
              key="ready"
              className="mx-auto max-w-xl"
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
            >
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
              className="space-y-8"
            >
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <StatPill icon={Timer} value={`${minutes}:${seconds}`} tone={timeUrgent ? "urgent" : "neutral"} big pulse={timeUrgent} />
                <StatPill icon={Zap} label="WPM" value={live.wpm} tone="blue" />
                <StatPill icon={Target} label="Accuracy" value={`${live.accuracy}%`} tone="emerald" />
                <StatPill icon={Percent} label="সম্পন্ন" value={`${charProgress}%`} tone="violet" />
              </div>

              <div className="mx-auto h-1.5 w-full max-w-xl overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className={`h-full rounded-full ${timeUrgent ? "bg-red-500" : "bg-brand-500"}`}
                  animate={{ width: `${timeProgress}%` }}
                  transition={{ duration: 0.5, ease: "linear" }}
                />
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

              <AnimatePresence>
                {phase === "running" && charProgress >= 100 && (
                  <motion.div
                    initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="mx-auto flex max-w-xl items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700"
                  >
                    সম্পন্ন! সময় শেষ না হওয়া পর্যন্ত অপেক্ষা করুন — তারপর স্বয়ংক্রিয়ভাবে জমা হয়ে যাবে।
                  </motion.div>
                )}
              </AnimatePresence>
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
      </div>

      {phase === "countdown" && <ExamCountdown onComplete={handleCountdownComplete} />}
    </div>
  );
}
