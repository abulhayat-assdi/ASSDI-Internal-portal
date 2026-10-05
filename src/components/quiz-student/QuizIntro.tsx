"use client";

import { HelpCircle, Timer, Repeat2, Dumbbell, Loader2 } from "lucide-react";
import { GLASS_PANEL } from "@/components/typing-exam/ui";
import { Html, formatDuration } from "./shared";

export interface QuizIntroInfo {
  title: string;
  descriptionHtml: string;
  questionCount: number;
  durationSeconds: number | null;
  maxAttempts: number;
  attemptsUsed: number;
}

export default function QuizIntro({
  info,
  practice,
  starting,
  onStart,
}: {
  info: QuizIntroInfo;
  practice: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <div className={`${GLASS_PANEL} rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto space-y-5`}>
      {practice && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          <Dumbbell className="h-3.5 w-3.5" /> প্র্যাকটিস মোড - ফলাফল গণনায় আসবে না
        </span>
      )}
      <h1 className="no-gradient text-2xl font-bold text-slate-800">{info.title}</h1>
      {info.descriptionHtml && <Html html={info.descriptionHtml} className="text-sm text-slate-600" />}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <li className="rounded-xl bg-slate-50 p-3 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-brand-600" /> {info.questionCount} টি প্রশ্ন
        </li>
        <li className="rounded-xl bg-slate-50 p-3 flex items-center gap-2">
          <Timer className="h-4 w-4 text-brand-600" />
          {info.durationSeconds ? formatDuration(info.durationSeconds) : "সময়সীমা নেই"}
        </li>
        {!practice && (
          <li className="rounded-xl bg-slate-50 p-3 flex items-center gap-2">
            <Repeat2 className="h-4 w-4 text-brand-600" /> চেষ্টা {info.attemptsUsed + 1}/{info.maxAttempts}
          </li>
        )}
      </ul>
      {info.durationSeconds ? (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          শুরু করার সাথে সাথেই টাইমার চলবে। পেজ রিফ্রেশ করলেও সময় থামবে না, এবং সময় শেষ হলে কুইজ নিজে থেকে জমা হবে।
        </p>
      ) : null}
      <p className="text-xs text-slate-500">কুইজ চলাকালীন অন্য ট্যাবে গেলে তা শিক্ষকের কাছে রেকর্ড হতে পারে।</p>
      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-60"
      >
        {starting && <Loader2 className="h-4 w-4 animate-spin" />}
        কুইজ শুরু করুন
      </button>
    </div>
  );
}
