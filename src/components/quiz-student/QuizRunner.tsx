"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CloudOff, Loader2, Send, Timer } from "lucide-react";
import { GLASS_PANEL, StatPill } from "@/components/typing-exam/ui";
import QuestionCard, { type AnswerState } from "./QuestionCard";
import { formatClock, useSecondsLeft, type OptionLabelStyle, type StudentQuestion } from "./shared";

export interface RunnerData {
  attemptId: string;
  isPractice: boolean;
  quiz: {
    title: string;
    durationSeconds: number | null;
    allowBacktrack: boolean;
    optionLabelStyle: OptionLabelStyle;
  };
  startedAt: string;
  questions: StudentQuestion[];
  savedAnswers: { questionId: string; selectedOptionIds: unknown; shortAnswerText: string | null }[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

function hasAnswer(a: AnswerState | undefined) {
  return !!a && (a.selected.length > 0 || a.text.trim().length > 0);
}

export default function QuizRunner({
  quizId,
  data,
  onSubmitted,
}: {
  quizId: string;
  data: RunnerData;
  onSubmitted: (attemptId: string) => void;
}) {
  const { attemptId, questions, quiz } = data;
  const base = `/api/student/quiz/${quizId}/attempt/${attemptId}`;

  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const init: Record<string, AnswerState> = {};
    for (const s of data.savedAnswers) {
      init[s.questionId] = {
        selected: Array.isArray(s.selectedOptionIds) ? (s.selectedOptionIds as string[]) : [],
        text: s.shortAnswerText ?? "",
      };
    }
    return init;
  });
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tabNotice, setTabNotice] = useState(false);

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflight = useRef<Set<Promise<unknown>>>(new Set());
  const submittedRef = useRef(false);
  const autoTried = useRef(false);

  const deadline = quiz.durationSeconds ? new Date(data.startedAt).getTime() + quiz.durationSeconds * 1000 : null;
  const secondsLeft = useSecondsLeft(deadline);

  const save = useCallback(
    (questionId: string) => {
      const a = answersRef.current[questionId] ?? { selected: [], text: "" };
      const isShort = questions.find((q) => q.id === questionId)?.type === "SHORT_ANSWER";
      setSaveState((s) => ({ ...s, [questionId]: "saving" }));
      const p = fetch(`${base}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isShort ? { questionId, shortAnswerText: a.text } : { questionId, selectedOptionIds: a.selected }
        ),
      })
        .then((res) => setSaveState((s) => ({ ...s, [questionId]: res.ok ? "saved" : "error" })))
        .catch(() => setSaveState((s) => ({ ...s, [questionId]: "error" })))
        .finally(() => inflight.current.delete(p));
      inflight.current.add(p);
      return p;
    },
    [base, questions]
  );

  const flush = useCallback(async () => {
    for (const [qid, t] of Object.entries(timers.current)) {
      clearTimeout(t);
      delete timers.current[qid];
      save(qid);
    }
    await Promise.all([...inflight.current]);
  }, [save]);

  const changeAnswer = (q: StudentQuestion, next: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [q.id]: next }));
    answersRef.current = { ...answersRef.current, [q.id]: next };
    setSaveState((s) => ({ ...s, [q.id]: "saving" }));
    clearTimeout(timers.current[q.id]);
    const delay = q.type === "SHORT_ANSWER" ? 700 : 150;
    timers.current[q.id] = setTimeout(() => {
      delete timers.current[q.id];
      save(q.id);
    }, delay);
  };

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await flush();
      const res = await fetch(`${base}/submit`, { method: "POST" });
      // 409 means it was already finalized (e.g. double submit) - the result page is still correct.
      if (!res.ok && res.status !== 409) throw new Error("submit failed");
      onSubmitted(attemptId);
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError("জমা দেওয়া যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।");
    }
  }, [attemptId, base, flush, onSubmitted]);

  // Auto-submit when the countdown reaches zero.
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 0 && !autoTried.current) {
      autoTried.current = true;
      submit();
    }
  }, [secondsLeft, submit]);

  // Report tab switches.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && !submittedRef.current) {
        fetch(`${base}/tab-switch`, { method: "POST" }).catch(() => undefined);
        setTabNotice(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [base]);

  // Flush pending debounced saves when leaving the page.
  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  const q = questions[index];
  const unanswered = questions.filter((x) => !hasAnswer(answers[x.id])).length;
  const st = saveState[q.id] ?? (hasAnswer(answers[q.id]) ? "saved" : "idle");
  const timeUp = secondsLeft !== null && secondsLeft <= 0;
  const low = secondsLeft !== null && secondsLeft <= 60;

  const goto = (i: number) => {
    flush();
    setIndex(Math.min(Math.max(i, 0), questions.length - 1));
  };
  const isLast = index === questions.length - 1;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-4 sm:pb-16">
      <div className={`${GLASS_PANEL} sticky top-[4.5rem] z-10 rounded-2xl px-3 sm:px-4 py-3 flex items-center justify-between gap-3`}>
        <h2 className="truncate text-sm font-bold text-slate-700">
          {quiz.title}
          {data.isPractice ? " (প্র্যাকটিস)" : ""}
        </h2>
        {secondsLeft !== null && (
          <StatPill icon={Timer} value={formatClock(secondsLeft)} tone={low ? "urgent" : "blue"} pulse={low} />
        )}
      </div>

      {tabNotice && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">আপনি অন্য ট্যাবে গিয়েছিলেন - বিষয়টি রেকর্ড করা হয়েছে।</span>
          <button className="cursor-pointer font-semibold" onClick={() => setTabNotice(false)}>
            ঠিক আছে
          </button>
        </div>
      )}

      <div className={`${GLASS_PANEL} rounded-2xl p-4 sm:p-6`}>
        <QuestionCard
          key={q.id}
          question={q}
          index={index}
          total={questions.length}
          labelStyle={quiz.optionLabelStyle}
          answer={answers[q.id] ?? { selected: [], text: "" }}
          onChange={(next) => changeAnswer(q, next)}
        />
        <div className="mt-3 h-5 text-xs" aria-live="polite">
          {st === "saving" && (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> সেভ হচ্ছে...
            </span>
          )}
          {st === "saved" && (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <Check className="h-3 w-3" /> সেভ হয়েছে
            </span>
          )}
          {st === "error" && (
            <button
              className="cursor-pointer inline-flex items-center gap-1 text-red-600 font-medium"
              onClick={() => save(q.id)}
            >
              <CloudOff className="h-3 w-3" /> সেভ হয়নি - আবার চেষ্টা করুন
            </button>
          )}
        </div>
      </div>

      {quiz.allowBacktrack && (
        <div className={`${GLASS_PANEL} rounded-2xl p-4`}>
          <p className="text-xs font-semibold text-slate-500 mb-2">প্রশ্ন নেভিগেটর</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => goto(i)}
                aria-label={`প্রশ্ন ${i + 1}`}
                aria-current={i === index}
                className={`cursor-pointer h-9 w-9 rounded-lg text-sm font-semibold transition-colors ${
                  i === index
                    ? "bg-brand-600 text-white"
                    : hasAnswer(answers[x.id])
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {quiz.allowBacktrack ? (
          <button
            type="button"
            onClick={() => goto(index - 1)}
            disabled={index === 0}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> আগের
          </button>
        ) : (
          <span />
        )}
        {isLast ? (
          <button
            type="button"
            onClick={() => {
              flush();
              setConfirming(true);
            }}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Send className="h-4 w-4" /> জমা দিন
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goto(index + 1)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            পরের <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {quiz.allowBacktrack && !isLast && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              flush();
              setConfirming(true);
            }}
            className="cursor-pointer text-sm font-medium text-slate-500 underline"
          >
            এখনই জমা দিন
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">কুইজ জমা দেবেন?</h3>
            {unanswered > 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                আপনার {unanswered} টি প্রশ্নের উত্তর দেওয়া হয়নি।
              </p>
            ) : (
              <p className="text-sm text-slate-600">সব প্রশ্নের উত্তর দেওয়া হয়েছে।</p>
            )}
            <p className="text-xs text-slate-500">জমা দেওয়ার পর আর উত্তর বদলানো যাবে না।</p>
            {submitError && <p role="alert" className="text-sm text-red-600">{submitError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirming(false)}
                className="cursor-pointer flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600"
              >
                ফিরে যান
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="cursor-pointer flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} জমা দিন
              </button>
            </div>
          </div>
        </div>
      )}

      {(submitting || timeUp) && !confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600 mx-auto" />
            <p className="mt-3 text-sm text-slate-600">সময় শেষ - কুইজ জমা হচ্ছে...</p>
            {submitError && <p className="mt-2 text-sm text-red-600">{submitError}</p>}
            {submitError && (
              <button className="cursor-pointer mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm text-white" onClick={submit}>
                আবার চেষ্টা করুন
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
