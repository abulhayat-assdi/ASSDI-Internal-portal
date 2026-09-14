"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreAttempt } from "@/lib/typing-exam/scoring";

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
      let cls = "text-gray-400";
      if (i < typedText.length) {
        cls = typedText[i] === ch ? "text-green-600" : "text-red-600 bg-red-50";
      } else if (i === typedText.length) {
        cls = "text-gray-800 underline decoration-2 decoration-blue-500";
      }
      return (
        <span key={i} className={cls}>
          {ch}
        </span>
      );
    });
  }, [examText, typedText]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  if (phase === "idle") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="mb-4 text-sm text-gray-600">
          পরীক্ষা শুরু করলে টাইমার সাথে সাথে চালু হয়ে যাবে। সময়: {Math.floor(durationSeconds / 60)} মিনিট{" "}
          {durationSeconds % 60 > 0 ? `${durationSeconds % 60} সেকেন্ড` : ""}
        </p>
        <button
          onClick={start}
          className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          পরীক্ষা শুরু করুন
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className={`text-2xl font-bold tabular-nums ${secondsLeft <= 10 ? "text-red-600" : "text-gray-800"}`}>
          {minutes}:{seconds}
        </div>
        <div className="flex gap-4 text-sm text-gray-600">
          <span>WPM: <strong className="text-gray-900">{phase === "running" ? live.wpm : 0}</strong></span>
          <span>Accuracy: <strong className="text-gray-900">{phase === "running" ? live.accuracy : 0}%</strong></span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 font-mono text-lg leading-relaxed whitespace-pre-wrap break-words">
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
        className="w-full rounded-lg border border-gray-300 p-4 font-mono text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />

      <button
        onClick={() => finish(typedText)}
        disabled={phase !== "running" || submitting}
        className="rounded-lg bg-gray-800 px-5 py-2 font-medium text-white hover:bg-gray-900 disabled:opacity-50"
      >
        {submitting ? "জমা হচ্ছে..." : "জমা দিন"}
      </button>
    </div>
  );
}
