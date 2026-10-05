"use client";

import { CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react";
import { GLASS_PANEL } from "@/components/typing-exam/ui";
import { Html, optionLabel, type OptionLabelStyle, type QuestionType } from "./shared";

export interface ReviewItem {
  questionId: string;
  type: QuestionType;
  bodyHtml: string;
  marks: number;
  explanationHtml: string;
  options: { id: string; textHtml: string; isCorrect: boolean }[];
  selectedOptionIds: string[];
  shortAnswerText: string | null;
  isCorrect: boolean | null;
  marksAwarded: number;
  pendingManualGrading: boolean;
}

function StatusBadge({ item }: { item: ReviewItem }) {
  if (item.pendingManualGrading)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <Clock className="h-3.5 w-3.5" /> গ্রেডিং বাকি
      </span>
    );
  if (item.isCorrect === true)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> সঠিক
      </span>
    );
  if (item.isCorrect === false)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
        <XCircle className="h-3.5 w-3.5" /> ভুল
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
      <MinusCircle className="h-3.5 w-3.5" /> উত্তর দেওয়া হয়নি
    </span>
  );
}

export default function ResultReview({ review, labelStyle = "LETTERS" }: { review: ReviewItem[]; labelStyle?: OptionLabelStyle }) {
  return (
    <div className="space-y-4">
      {review.map((item, n) => (
        <div key={item.questionId} className={`${GLASS_PANEL} rounded-2xl p-4 sm:p-5 space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">প্রশ্ন {n + 1}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-slate-600">
                {item.marksAwarded}/{item.marks}
              </span>
              <StatusBadge item={item} />
            </div>
          </div>
          <Html html={item.bodyHtml} className="font-medium text-slate-800" />

          {item.type === "SHORT_ANSWER" ? (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold text-slate-500 mb-1">আপনার উত্তর</p>
              {item.shortAnswerText ? <p className="whitespace-pre-wrap break-words text-slate-700">{item.shortAnswerText}</p> : <span className="text-slate-400">দেওয়া হয়নি</span>}
            </div>
          ) : (
            <ul className="space-y-2">
              {item.options.map((o, i) => {
                const picked = item.selectedOptionIds.includes(o.id);
                const tone = o.isCorrect
                  ? "border-emerald-500 bg-emerald-50"
                  : picked
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 bg-white";
                return (
                  <li key={o.id} className={`flex items-start gap-3 rounded-xl border-2 p-2.5 ${tone}`}>
                    <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-white/80 px-1 text-xs font-bold text-slate-600">
                      {optionLabel(labelStyle, i)}
                    </span>
                    <Html html={o.textHtml} className="flex-1 text-sm text-slate-700" />
                    <span className="text-[11px] font-semibold shrink-0">
                      {picked && <span className={o.isCorrect ? "text-emerald-700" : "text-red-600"}>আপনার উত্তর </span>}
                      {o.isCorrect && <span className="text-emerald-700">সঠিক</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {item.explanationHtml && (
            <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
              <p className="text-xs font-bold mb-1">ব্যাখ্যা</p>
              <Html html={item.explanationHtml} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
