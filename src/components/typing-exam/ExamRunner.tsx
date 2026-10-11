"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Timer, Zap, Target, Percent } from "lucide-react";
import { scoreAttempt } from "@/lib/typing-exam/scoring";
import { TypingExamEngine } from "@/lib/typing-exam/engine";
import { toWirePayload, type ExamWirePayload } from "@/lib/typing-exam/client";
import { GLASS_PANEL, StatPill } from "@/components/typing-exam/ui";
import ExamReadyScreen from "@/components/typing-exam/ExamReadyScreen";
import ExamCountdown from "@/components/typing-exam/ExamCountdown";
import ExamFullscreenBanner from "@/components/typing-exam/ExamFullscreenBanner";
import TypingField from "@/components/typing-exam/TypingField";
import { caretIndex } from "@/lib/typing-exam/lineWrap";

type Phase = "ready" | "countdown" | "running" | "finished";

/** UI refresh rate for the timer and live stats; the deadline itself is exact. */
const TICK_MS = 200;
/** Autosave interval while typing (only sent when something changed). */
const AUTOSAVE_MS = 3000;

export interface ExamRunnerSubmitPayload extends ExamWirePayload {
  /**
   * Present only when the taker went through the ready-screen retry-password
   * gate (attemptsUsed > 0) and it verified. ExamRunner itself stays
   * taker-type-agnostic (STUDENT vs PUBLIC) — the calling page decides how
   * to include it in its own requests.
   */
  retryPassword?: string;
}

export interface ExamRunnerProps {
  examText: string;
  durationSeconds: number;
  /** Called once, when the run ends (time up or passage completed). */
  onSubmit: (payload: ExamRunnerSubmitPayload) => void | Promise<void>;
  /** Called as the countdown begins — the page opens its server session here. */
  onBegin?: (retryPassword?: string) => void;
  /** Autosave hook. `beacon` is true when the tab is being hidden or closed. */
  onProgress?: (payload: ExamWirePayload, beacon: boolean) => void;
  submitting?: boolean;
  /** Number of prior attempts by this taker. >0 shows the retry-password gate on the ready screen. */
  attemptsUsed?: number;
  /** Verifies a retry password against the server; resolve `true`/`false`. Required only when `attemptsUsed` can be > 0. */
  onVerifyRetryPassword?: (password: string) => Promise<boolean>;
}

/** Keeps a ref pointing at the latest value, so effects never read a stale prop. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/**
 * Shared typing-exam taking UI. Phases: "ready" (explains flow, requests
 * fullscreen + retry-password gate) -> "countdown" (3-2-1-go overlay) ->
 * "running" (timer + Monkeytype-style passage + live WPM/accuracy preview)
 * -> "finished" (brief loading state while the async onSubmit resolves).
 *
 * All run state lives in a TypingExamEngine held in a ref (see engine.ts);
 * React state here is only a render mirror of it. The submission is always
 * built from engine.snapshot() at the moment the run ends, never from a
 * value captured in a closure — that closure bug is what made every
 * time-up submission arrive empty (0 WPM / 0%) before this engine.
 *
 * The authoritative score is recomputed server-side; the live numbers here
 * are UX only. The calling page renders <ExamResultPanel> with the server's
 * graded response.
 */
export default function ExamRunner({
  examText,
  durationSeconds,
  onSubmit,
  onBegin,
  onProgress,
  submitting,
  attemptsUsed,
  onVerifyRetryPassword,
}: ExamRunnerProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [typedText, setTypedText] = useState("");
  const [clock, setClock] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const engineRef = useRef<TypingExamEngine | null>(null);
  const submittedRef = useRef(false);
  const pendingRetryPasswordRef = useRef<string | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const onSubmitRef = useLatest(onSubmit);
  const onBeginRef = useLatest(onBegin);
  const onProgressRef = useLatest(onProgress);

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

  // Stable for the component's lifetime: reads everything through refs.
  const finish = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || submittedRef.current) return;
    submittedRef.current = true;
    const payload = toWirePayload(engine.snapshot(Date.now()));
    setTypedText(payload.typedText);
    setPhase("finished");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onSubmitRef.current({
      ...payload,
      ...(pendingRetryPasswordRef.current ? { retryPassword: pendingRetryPasswordRef.current } : {}),
    });
  }, [onSubmitRef]);

  useEffect(() => {
    if (phase !== "running") return;
    const engine = engineRef.current;
    if (!engine) return;

    const save = (beacon: boolean) => onProgressRef.current?.(toWirePayload(engine.snapshot(Date.now())), beacon);

    // The deadline is wall-clock based inside the engine, so a throttled
    // background tab or a missed tick can delay the UI but never the cutoff.
    const tick = setInterval(() => {
      const now = Date.now();
      if (engine.tick(now)) {
        finish();
        return;
      }
      setClock(now);
    }, TICK_MS);

    let savedRevision = engine.revision;
    const autosave = setInterval(() => {
      if (engine.finished || engine.revision === savedRevision) return;
      savedRevision = engine.revision;
      save(false);
    }, AUTOSAVE_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !engine.finished) save(true);
    };
    const onPageHide = () => {
      if (!engine.finished) save(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (engine.finished) return;
      save(true);
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(tick);
      clearInterval(autosave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [phase, finish, onProgressRef]);

  const handleReadyStart = useCallback(
    (retryPassword?: string) => {
      pendingRetryPasswordRef.current = retryPassword;
      submittedRef.current = false;
      engineRef.current = new TypingExamEngine(examText, durationSeconds * 1000);
      setTypedText("");
      setClock(0);
      setPhase("countdown");
      onBeginRef.current?.(retryPassword);
    },
    [examText, durationSeconds, onBeginRef]
  );

  const handleCountdownComplete = useCallback(() => {
    const now = Date.now();
    engineRef.current?.start(now);
    setClock(now);
    setPhase("running");
  }, []);

  const handleChange = (value: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const now = Date.now();
    setTypedText(engine.input(value, now));
    setClock(now);
    // Typing the last character of the passage (or input arriving after the
    // deadline) ends the run.
    if (engine.finished) finish();
  };

  const engine = engineRef.current;
  const live = useMemo(() => {
    if (!engine || !engine.started) return { wpm: 0, accuracy: 0 };
    const snap = engine.snapshot(clock || Date.now());
    return scoreAttempt({
      originalText: examText,
      typedText: snap.typedText,
      elapsedMs: snap.elapsedMs,
      keystrokes: snap.keystrokes,
    });
    // typedText is the render mirror of the engine's text — recompute on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, examText, typedText, clock]);

  const secondsLeft = engine ? Math.ceil(engine.remainingMs(clock || Date.now()) / 1000) : durationSeconds;
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const timeUrgent = secondsLeft <= 10 && phase === "running";
  const timeProgress = Math.max(0, Math.min(100, (secondsLeft / durationSeconds) * 100));
  const charProgress = examText.length > 0 ? Math.round((caretIndex(examText, typedText) / examText.length) * 100) : 0;
  const waitingForFirstKey = phase === "running" && !!engine && !engine.started;

  // While the browser has this container as the fullscreen element, own the
  // whole viewport with a solid light background and center everything —
  // without this, the fullscreened box (which is only as tall as its own
  // content) leaves the browser's default black ::backdrop showing through
  // above/below it, and nothing recenters the content for the new size.
  const rootClass = isFullscreen
    ? "fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-white via-slate-50 to-white px-4 py-10 sm:px-8"
    : "relative";
  const phaseWrapClass = isFullscreen ? "w-full" : "";

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
                <StatPill icon={Zap} label="WPM" value={Math.round(live.wpm)} tone="blue" />
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

              {waitingForFirstKey && (
                <p className="text-center text-sm text-slate-500">প্রথম অক্ষর টাইপ করলেই সময় চালু হবে</p>
              )}

              <TypingField
                examText={examText}
                typedText={typedText}
                onChange={handleChange}
                disabled={phase !== "running" || submitting}
              />
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
