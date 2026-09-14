"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Keyboard, Timer, Zap, Target } from "lucide-react";
import { scoreAttempt } from "@/lib/typing-exam/scoring";
import { GLASS_PANEL } from "@/components/typing-exam/ui";

type Phase = "idle" | "running" | "finished";

export interface ExamRunnerSubmitPayload {
  typedText: string;
  elapsedSeconds: number;
}

interface ExamRunnerProps {
  examText: string;
  durationSeconds: number;
  onSubmit: (payload: ExamRunnerSubmitPayload) => void | Promise<void>;
  submitting?: boolean;
}

/**
 * Shared typing-exam taking UI: passage display with live correctness
 * highlighting, countdown timer, and live WPM/accuracy preview. The
 * authoritative score is always recomputed server-side from the submitted
 * typedText + elapsedSeconds — this component's live numbers are UX only.
 */
export default function ExamRunner({ examText, durationSeconds, onSubmit, submitting }: ExamRunnerProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [typedText, setTypedText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const startedAtRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const finish = useCallback(
    (finalTypedText: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setPhase("finished");
      const elapsed = startedAtRef.current
        ? Math.min(durationSeconds, Math.round((Date.now() - startedAtRef.current) / 1000))
        : durationSeconds;
      onSubmit({ typedText: finalTypedText, elapsedSeconds: Math.max(elapsed, 1) });
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

  const start = () => {
    setPhase("running");
    setSecondsLeft(durationSeconds);
    startedAtRef.current = Date.now();
    submittedRef.current = false;
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
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

  const chars = useMemo(() => {
    return examText.split("").map((ch, i) => {
      let cls = "text-slate-300";
      if (i < typedText.length) {
        cls = typedText[i] === ch ? "text-emerald-600" : "text-red-600 bg-red-50 rounded-[2px]";
      } else if (i === typedText.length) {
        cls = "text-slate-800 border-b-2 border-blue-500";
      }
      return (
        <span key={i} className={`transition-colors duration-100 ${cls}`}>
          {ch}
        </span>
      );
    });
  }, [examText, typedText]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const timeUrgent = secondsLeft <= 10 && phase === "running";
  const timeProgress = Math.max(0, Math.min(100, (secondsLeft / durationSeconds) * 100));
  const durationLabel = `${Math.floor(durationSeconds / 60)} মিনিট${durationSeconds % 60 > 0 ? ` ${durationSeconds % 60} সেকেন্ড` : ""}`;

  return (
    <AnimatePresence mode="wait">
      {phase === "idle" ? (
        <motion.div
          key="idle"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`${GLASS_PANEL} rounded-2xl p-8 text-center`}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Keyboard className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="mb-5 text-sm text-slate-500">
            পরীক্ষা শুরু করলে টাইমার সাথে সাথে চালু হয়ে যাবে। সময়: <span className="font-semibold text-slate-700">{durationLabel}</span>
          </p>
          <motion.button
            onClick={start}
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="cursor-pointer rounded-xl bg-brand-600 px-7 py-3 font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700"
          >
            পরীক্ষা শুরু করুন
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          key="running"
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

          <div className={`${GLASS_PANEL} rounded-2xl p-5 font-mono text-lg leading-relaxed whitespace-pre-wrap break-words`}>
            {chars}
          </div>

          <textarea
            ref={textareaRef}
            value={typedText}
            onChange={handleChange}
            onPaste={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            disabled={phase !== "running" || submitting}
            rows={5}
            placeholder="এখানে টাইপ শুরু করুন..."
            className="w-full rounded-2xl border border-slate-200 bg-white/90 p-4 font-mono text-lg shadow-sm transition-shadow focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
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
    </AnimatePresence>
  );
}
