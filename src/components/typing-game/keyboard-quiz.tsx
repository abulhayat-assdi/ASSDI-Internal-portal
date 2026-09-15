"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import type { Locale } from "@/lib/typing-game/i18n";

interface QuizOption {
  en: string;
  bn: string;
}

interface QuizQuestion {
  qEn: string;
  qBn: string;
  options: QuizOption[];
  /** index into options */
  answer: number;
  explainEn: string;
  explainBn: string;
}

const QUESTIONS: QuizQuestion[] = [
  {
    qEn: "Where should your left-hand fingers rest on home row?",
    qBn: "হোম রো-তে বাম হাতের আঙুল কোথায় রাখবেন?",
    options: [
      { en: "A, S, D, F", bn: "A, S, D, F" },
      { en: "Q, W, E, R", bn: "Q, W, E, R" },
      { en: "Z, X, C, V", bn: "Z, X, C, V" },
      { en: "1, 2, 3, 4", bn: "1, 2, 3, 4" },
    ],
    answer: 0,
    explainEn: "Left fingers rest on A, S, D, F — that's home base.",
    explainBn: "বাম হাতের আঙুল A, S, D, F-এ থাকে — এটাই হোম বেস।",
  },
  {
    qEn: "How do you find home row without looking?",
    qBn: "না তাকিয়ে হোম রো কীভাবে খুঁজবেন?",
    options: [
      { en: "Guess randomly", bn: "আন্দাজে চাপুন" },
      { en: "Feel the small bumps on F and J", bn: "F ও J-এর ছোট উঁচু বিন্দু অনুভব করুন" },
      { en: "Look at the keyboard first", bn: "আগে কিবোর্ডের দিকে তাকান" },
      { en: "Ask someone else", bn: "অন্য কাউকে জিজ্ঞেস করুন" },
    ],
    answer: 1,
    explainEn: "F and J have small bumps so you can find home row by touch.",
    explainBn: "F ও J-তে ছোট বিন্দু আছে যাতে ছুঁয়েই হোম রো পাওয়া যায়।",
  },
  {
    qEn: "Where should your right-hand fingers rest?",
    qBn: "ডান হাতের আঙুল কোথায় রাখবেন?",
    options: [
      { en: "H, J, K, L", bn: "H, J, K, L" },
      { en: "J, K, L, ;", bn: "J, K, L, ;" },
      { en: "Y, U, I, O", bn: "Y, U, I, O" },
      { en: "N, M, ,, .", bn: "N, M, ,, ." },
    ],
    answer: 1,
    explainEn: "Right fingers rest on J, K, L, ; — mirror of the left hand.",
    explainBn: "ডান হাতের আঙুল J, K, L, ;-এ থাকে — বাম হাতের আয়না।",
  },
  {
    qEn: "Where should your eyes be while typing?",
    qBn: "টাইপ করার সময় চোখ কোথায় রাখবেন?",
    options: [
      { en: "On your hands", bn: "হাতের দিকে" },
      { en: "On the keyboard", bn: "কিবোর্ডের দিকে" },
      { en: "On the screen", bn: "স্ক্রিনের দিকে" },
      { en: "Closed", bn: "বন্ধ করে" },
    ],
    answer: 2,
    explainEn: "Keep your eyes on the screen — fingers learn positions with practice.",
    explainBn: "চোখ স্ক্রিনে রাখুন — অনুশীলনে আঙুল অবস্থান শিখে যাবে।",
  },
  {
    qEn: "Which finger should press a key?",
    qBn: "কোন আঙুল দিয়ে কী চাপবেন?",
    options: [
      { en: "Always the index finger", bn: "সবসময় তর্জনী দিয়ে" },
      { en: "Whichever finger is free", bn: "যে আঙুল ফাঁকা থাকে সেটা দিয়ে" },
      { en: "The finger responsible for that key's zone", bn: "ওই কী-এর জোনের দায়িত্বপ্রাপ্ত আঙুল দিয়ে" },
      { en: "Thumbs for everything", bn: "সবকিছুর জন্য বৃদ্ধাঙ্গুলি দিয়ে" },
    ],
    answer: 2,
    explainEn: "Each finger owns the keys directly above, below, and next to it.",
    explainBn: "প্রতিটি আঙুল তার ঠিক উপরে, নিচে ও পাশের কী-গুলোর দায়িত্বে থাকে।",
  },
];

const CHROME = {
  quizTitle: { en: "Quick check — practice only", bn: "দ্রুত যাচাই — শুধু অনুশীলন" },
  quizIntro: {
    en: "5 short questions. Your score is just feedback — nothing is locked either way.",
    bn: "৫টা ছোট প্রশ্ন। স্কোর শুধু ফিডব্যাক — পাস/ফেল যাই হোক কিছুই লক হবে না।",
  },
  submit: { en: "Check my score", bn: "স্কোর দেখুন" },
  retry: { en: "Try again", bn: "আবার চেষ্টা করুন" },
  scorePerfect: { en: "Perfect! You're ready for Keyboard Village.", bn: "দারুণ! আপনি Keyboard Village-এর জন্য প্রস্তুত।" },
  scoreGood: { en: "Good — review the ones below and try again.", bn: "ভালো — নিচেরগুলো দেখে আবার চেষ্টা করুন।" },
  scoreLow: { en: "Read the lesson tips above once more, then retry.", bn: "উপরের টিপসগুলো আরেকবার পড়ে আবার চেষ্টা করুন।" },
  correct: { en: "Correct", bn: "সঠিক" },
  wrong: { en: "Not quite", bn: "হয়নি" },
  yourAnswer: { en: "Your answer", bn: "আপনার উত্তর" },
  correctAnswer: { en: "Correct answer", bn: "সঠিক উত্তর" },
} as const;

function tText(entry: { en: string; bn: string }, locale: Locale): string {
  return locale === "bn" ? entry.bn : entry.en;
}

/**
 * Informational practice quiz — deliberately NOT a gate. It shows a score
 * and per-question feedback, never blocks anything, and persists nothing
 * (no localStorage, no DB). Rendered under the keyboard lesson on the map.
 */
export function KeyboardQuiz({ locale }: { locale: Locale }) {
  const [picked, setPicked] = useState<Array<number | null>>(() => QUESTIONS.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = picked.every((p) => p !== null);
  const score = QUESTIONS.filter((q, i) => picked[i] === q.answer).length;

  function pick(qi: number, oi: number) {
    if (submitted) return;
    setPicked((prev) => prev.map((p, i) => (i === qi ? oi : p)));
  }

  function submit() {
    if (allAnswered) setSubmitted(true);
  }

  function retry() {
    setPicked(QUESTIONS.map(() => null));
    setSubmitted(false);
  }

  const scoreLine =
    score === QUESTIONS.length
      ? tText(CHROME.scorePerfect, locale)
      : score >= 3
        ? tText(CHROME.scoreGood, locale)
        : tText(CHROME.scoreLow, locale);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <h3 className="font-bold text-slate-800">{tText(CHROME.quizTitle, locale)}</h3>
      <p className="mt-0.5 text-sm text-slate-500">{tText(CHROME.quizIntro, locale)}</p>

      <ol className="mt-3 flex flex-col gap-4">
        {QUESTIONS.map((q, qi) => {
          const isRight = submitted && picked[qi] === q.answer;
          const isWrong = submitted && picked[qi] !== q.answer;
          return (
            <li key={qi}>
              <p className="text-sm font-semibold text-slate-700">
                {qi + 1}. {locale === "bn" ? q.qBn : q.qEn}
              </p>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                {q.options.map((opt, oi) => {
                  const selected = picked[qi] === oi;
                  const showCorrect = submitted && oi === q.answer;
                  const showWrongPick = submitted && selected && oi !== q.answer;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={submitted}
                      onClick={() => pick(qi, oi)}
                      className={[
                        "cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        showCorrect
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : showWrongPick
                            ? "border-red-300 bg-red-50 text-red-700"
                            : selected
                              ? "border-brand-400 bg-brand-50 text-brand-800"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                        submitted ? "cursor-default" : "",
                      ].join(" ")}
                    >
                      {locale === "bn" ? opt.bn : opt.en}
                    </button>
                  );
                })}
              </div>
              {submitted ? (
                <p
                  className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${
                    isRight ? "text-emerald-700" : isWrong ? "text-red-600" : "text-slate-500"
                  }`}
                >
                  {isRight ? (
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {isRight ? tText(CHROME.correct, locale) : tText(CHROME.wrong, locale)}
                  <span className="font-normal opacity-80">
                    — {locale === "bn" ? q.explainBn : q.explainEn}
                  </span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {!submitted ? (
        <button
          type="button"
          disabled={!allAnswered}
          onClick={submit}
          className="mt-4 cursor-pointer rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {tText(CHROME.submit, locale)}
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
          <p className="text-sm font-bold text-slate-800">
            {score}/{QUESTIONS.length} — {scoreLine}
          </p>
          <button
            type="button"
            onClick={retry}
            className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            {tText(CHROME.retry, locale)}
          </button>
        </div>
      )}
    </div>
  );
}
