"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Trophy, TrendingUp, RotateCcw, Sparkles } from "lucide-react";
import ConfettiBurst from "@/components/typing-exam/ConfettiBurst";
import { GLASS_PANEL, RESULT_META, modalPanel, fadeUp, staggerContainer } from "@/components/typing-exam/ui";

export interface ExamResultPanelData {
  wpm: number;
  accuracy: number;
  result: "PASS" | "AVERAGE" | "FAIL";
}

/**
 * Shared post-attempt result view for the STUDENT and PUBLIC typing-exam
 * flows (replaces the three separately hand-rolled result blocks). Purely
 * presentational — the caller supplies the server-graded `result`; this
 * component never re-derives scoring itself.
 *
 * Props:
 * - `result`: the server-graded {wpm, accuracy, result} — authoritative.
 * - `variant`: "student" | "public" — only "student" ever shows a retry button.
 * - `displayName`: optional taker name, shown in the PASS heading.
 * - `onRetry`: optional (student only) — fires on the "আবার চেষ্টা করুন"
 *   button click. This component stays dumb about HOW retry works — the
 *   actual retry-password prompt UI and the `/attempt` refetch live on the
 *   calling page, not here.
 *
 * On PASS: mounts `ConfettiBurst` + celebratory copy. On AVERAGE/FAIL: no
 * confetti, gentler motivational copy. Both share the same WPM/Accuracy
 * stat tiles and the `RESULT_META` tier badge from ui.tsx.
 */
export interface ExamResultPanelProps {
  result: ExamResultPanelData;
  variant: "student" | "public";
  displayName?: string;
  onRetry?: () => void;
}

const RESULT_ICON = { PASS: Trophy, AVERAGE: TrendingUp, FAIL: RotateCcw } as const;

const COPY: Record<"PASS" | "AVERAGE" | "FAIL", { heading: string; subtext: string }> = {
  PASS: { heading: "অভিনন্দন", subtext: "চমৎকার ফলাফল — আপনি পরীক্ষায় উত্তীর্ণ হয়েছেন।" },
  AVERAGE: { heading: "আরও অনুশীলন করুন", subtext: "খারাপ হয়নি! আরেকটু অনুশীলন করলেই আরও ভালো ফলাফল আসবে।" },
  FAIL: { heading: "আরও অনুশীলন করুন", subtext: "থেমে না গিয়ে চেষ্টা চালিয়ে যান — পরেরবার আরও ভালো হবে!" },
};

export default function ExamResultPanel({ result, variant, displayName, onRetry }: ExamResultPanelProps) {
  const reduceMotion = useReducedMotion();
  const isPass = result.result === "PASS";
  const meta = RESULT_META[result.result];
  const Icon = RESULT_ICON[result.result];
  const copy = COPY[result.result];

  return (
    <motion.div
      variants={reduceMotion ? undefined : modalPanel}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      className={`${GLASS_PANEL} relative overflow-hidden rounded-2xl p-8 text-center space-y-5`}
    >
      {isPass && <ConfettiBurst />}

      <motion.div
        initial={reduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${meta.badge}`}
      >
        <Icon className="h-8 w-8" strokeWidth={1.75} />
      </motion.div>

      <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${meta.badge}`}>
        {isPass && <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />}
        {meta.label}
      </div>

      <div>
        <h2 className="no-gradient text-xl font-bold text-slate-800">
          {isPass ? `${copy.heading}${displayName ? `, ${displayName}` : ""}! 🎉` : copy.heading}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{copy.subtext}</p>
      </div>

      <motion.div
        variants={reduceMotion ? undefined : staggerContainer}
        initial={reduceMotion ? undefined : "hidden"}
        animate={reduceMotion ? undefined : "show"}
        className="mx-auto grid max-w-sm grid-cols-2 gap-4"
      >
        <motion.div variants={reduceMotion ? undefined : fadeUp} className="rounded-xl bg-slate-50/80 p-5">
          <p className="text-3xl font-bold tabular-nums text-slate-800">{result.wpm}</p>
          <p className="mt-1 text-xs text-slate-500">WPM</p>
        </motion.div>
        <motion.div variants={reduceMotion ? undefined : fadeUp} className="rounded-xl bg-slate-50/80 p-5">
          <p className="text-3xl font-bold tabular-nums text-slate-800">{result.accuracy}%</p>
          <p className="mt-1 text-xs text-slate-500">Accuracy</p>
        </motion.div>
      </motion.div>

      {variant === "student" && onRetry && (
        <div className="pt-2">
          <p className="mb-3 text-xs text-slate-400">
            আবার পরীক্ষা দিতে হলে আপনার শিক্ষকের কাছ থেকে Retry Password সংগ্রহ করুন।
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-slate-900"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.25} />
            আবার চেষ্টা করুন
          </button>
        </div>
      )}
    </motion.div>
  );
}
