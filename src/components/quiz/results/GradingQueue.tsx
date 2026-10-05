"use client";

import { useState } from "react";
import { Check, X, PenLine } from "lucide-react";
import toast from "react-hot-toast";
import { GLASS_PANEL } from "@/components/typing-exam/ui";
import { stripHtml } from "../types";

export type GradingAttempt = {
    attemptId: string; studentName: string; studentRoll: string; studentBatchName: string; submittedAt: string | null;
    answers: { answerId: string; questionId: string; questionBodyHtml: string; questionMarks: number; shortAnswerText: string | null }[];
};

export default function GradingQueue({ items, quizId, onGraded }: { items: GradingAttempt[]; quizId: string; onGraded: () => void }) {
    const [busy, setBusy] = useState<string | null>(null);

    async function grade(answerId: string, isCorrect: boolean) {
        setBusy(answerId);
        const res = await fetch(`/api/quiz/${quizId}/grading/${answerId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isCorrect }),
        });
        setBusy(null);
        if (res.ok) onGraded();
        else toast.error("গ্রেড সেভ হয়নি");
    }

    const pending = items.reduce((n, a) => n + a.answers.length, 0);

    return (
        <section className={`${GLASS_PANEL} rounded-2xl p-5 ring-1 ring-amber-300/60`}>
            <h2 className="no-gradient font-bold text-slate-800 mb-1 flex items-center gap-2"><PenLine className="h-4 w-4 text-amber-500" /> ম্যানুয়াল গ্রেডিং ({pending} টি বাকি)</h2>
            <p className="text-xs text-slate-500 mb-4">শর্ট-আনসার উত্তর দেখে সঠিক/ভুল চিহ্নিত করুন — স্কোর স্বয়ংক্রিয়ভাবে আপডেট হবে।</p>
            <div className="space-y-4">
                {items.map((a) => (
                    <div key={a.attemptId} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                        <p className="text-sm font-semibold text-slate-800 mb-2">{a.studentName} <span className="font-normal text-slate-400">· {a.studentRoll} · {a.studentBatchName}</span></p>
                        <div className="space-y-3">
                            {a.answers.map((ans) => (
                                <div key={ans.answerId} className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500 mb-1">{stripHtml(ans.questionBodyHtml)} <span className="text-slate-400">({ans.questionMarks} মার্ক)</span></p>
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{ans.shortAnswerText || <i className="text-slate-400">উত্তর দেয়নি</i>}</p>
                                    <div className="flex gap-2">
                                        <button disabled={busy === ans.answerId} onClick={() => grade(ans.answerId, true)} className="cursor-pointer inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"><Check className="h-3.5 w-3.5" /> সঠিক</button>
                                        <button disabled={busy === ans.answerId} onClick={() => grade(ans.answerId, false)} className="cursor-pointer inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium disabled:opacity-50"><X className="h-3.5 w-3.5" /> ভুল</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
