"use client";

import { Trophy } from "lucide-react";
import { GLASS_PANEL } from "@/components/typing-exam/ui";
import { stripHtml } from "../types";

export type Analytics = {
    attemptCount: number;
    averagePercentage: number;
    perQuestion: { questionId: string; order: number; bodyHtml: string; correct: number; wrong: number; ungraded: number; answered: number; correctRate: number | null }[];
    leaderboard: { studentName: string; studentRoll: string; studentBatchName: string; score: number; totalMarks: number; percentage: number; durationTakenSeconds: number | null }[];
};

function Tile({ label, value }: { label: string; value: string | number }) {
    return (
        <div className={`${GLASS_PANEL} rounded-2xl p-4`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-800 tabular-nums mt-1">{value}</p>
        </div>
    );
}

function rateColor(rate: number | null) {
    if (rate == null) return "bg-slate-300";
    return rate >= 0.7 ? "bg-emerald-500" : rate >= 0.4 ? "bg-amber-500" : "bg-red-500";
}

export default function AnalyticsPanel({ data }: { data: Analytics }) {
    const hardest = [...data.perQuestion].filter((q) => q.correctRate != null).sort((a, b) => (a.correctRate ?? 0) - (b.correctRate ?? 0))[0];
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Tile label="সম্পন্ন অ্যাটেম্পট" value={data.attemptCount} />
                <Tile label="গড় স্কোর" value={`${data.averagePercentage.toFixed(1)}%`} />
                <Tile label="সবচেয়ে কঠিন প্রশ্ন" value={hardest ? `Q${hardest.order + 1}` : "—"} />
            </div>

            <section className={`${GLASS_PANEL} rounded-2xl p-5`}>
                <h2 className="no-gradient font-bold text-slate-800 mb-4">প্রশ্ন অনুযায়ী সঠিক হার</h2>
                {data.perQuestion.length === 0 ? <p className="text-sm text-slate-400">ডেটা নেই।</p> : (
                    <div className="space-y-3">
                        {data.perQuestion.map((q) => (
                            <div key={q.questionId}>
                                <div className="flex justify-between gap-3 text-sm mb-1">
                                    <span className="text-slate-700 truncate"><b className="text-slate-400 mr-1.5">Q{q.order + 1}</b>{stripHtml(q.bodyHtml) || "—"}</span>
                                    <span className="text-slate-500 tabular-nums shrink-0">{q.correctRate == null ? "—" : `${Math.round(q.correctRate * 100)}%`} ({q.correct}/{q.answered})</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div className={`h-full rounded-full ${rateColor(q.correctRate)}`} style={{ width: `${Math.round((q.correctRate ?? 0) * 100)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className={`${GLASS_PANEL} rounded-2xl p-5`}>
                <h2 className="no-gradient font-bold text-slate-800 mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> লিডারবোর্ড</h2>
                {data.leaderboard.length === 0 ? <p className="text-sm text-slate-400">এখনো কোনো সম্পন্ন অ্যাটেম্পট নেই।</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100"><th className="py-2 pr-3">#</th><th className="pr-3">নাম</th><th className="pr-3">রোল</th><th className="pr-3">ব্যাচ</th><th className="pr-3 text-right">স্কোর</th><th className="text-right">%</th></tr></thead>
                            <tbody>
                                {data.leaderboard.map((r, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        <td className="py-2 pr-3 font-bold text-slate-400">{i + 1}</td>
                                        <td className="pr-3 font-medium text-slate-800">{r.studentName}</td>
                                        <td className="pr-3 text-slate-500">{r.studentRoll}</td>
                                        <td className="pr-3 text-slate-500">{r.studentBatchName}</td>
                                        <td className="pr-3 text-right tabular-nums">{r.score}/{r.totalMarks}</td>
                                        <td className="text-right tabular-nums">{r.percentage.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
