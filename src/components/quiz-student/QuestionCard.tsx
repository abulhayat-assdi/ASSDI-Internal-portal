"use client";

import { Check } from "lucide-react";
import { Html, optionLabel, type OptionLabelStyle, type StudentQuestion } from "./shared";

export interface AnswerState {
  selected: string[];
  text: string;
}

/** One question with its option list (radio / checkbox look) or a short-answer box. */
export default function QuestionCard({
  question,
  index,
  total,
  labelStyle,
  answer,
  onChange,
}: {
  question: StudentQuestion;
  index: number;
  total: number;
  labelStyle: OptionLabelStyle;
  answer: AnswerState;
  onChange: (next: AnswerState) => void;
}) {
  const multi = question.type === "MULTI_CHOICE";

  const toggle = (id: string) => {
    if (multi) {
      const has = answer.selected.includes(id);
      onChange({ ...answer, selected: has ? answer.selected.filter((x) => x !== id) : [...answer.selected, id] });
    } else {
      onChange({ ...answer, selected: answer.selected[0] === id ? [] : [id] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>
          প্রশ্ন {index + 1} / {total}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{question.marks} মার্কস</span>
      </div>
      <Html html={question.bodyHtml} className="text-base sm:text-lg font-medium text-slate-800" />

      {question.type === "SHORT_ANSWER" ? (
        <textarea
          value={answer.text}
          onChange={(e) => onChange({ ...answer, text: e.target.value })}
          rows={5}
          placeholder="আপনার উত্তর লিখুন..."
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm sm:text-base text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      ) : (
        <div role={multi ? "group" : "radiogroup"} className="space-y-2.5">
          {multi && <p className="text-xs text-violet-600 font-medium">একাধিক সঠিক উত্তর বাছাই করতে পারেন।</p>}
          {question.options.map((opt, i) => {
            const checked = answer.selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={checked}
                onClick={() => toggle(opt.id)}
                className={`cursor-pointer w-full flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                  checked ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center ${multi ? "rounded-md" : "rounded-full"} px-1 text-sm font-bold ${
                    checked ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {checked && multi ? <Check className="h-4 w-4" strokeWidth={3} /> : optionLabel(labelStyle, i)}
                </span>
                <Html html={opt.textHtml} className="flex-1 text-sm sm:text-base text-slate-700" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
