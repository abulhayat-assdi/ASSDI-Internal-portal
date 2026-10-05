"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { GLASS_PANEL } from "@/components/typing-exam/ui";
import { formatDateTime } from "../types";
import { btnGhost, fieldClass } from "../ui";

export type AttemptRow = {
    id: string; studentName: string; studentRoll: string; studentBatchName: string; attemptNumber: number; isPractice: boolean;
    status: "IN_PROGRESS" | "SUBMITTED" | "AWAITING_GRADING" | "GRADED"; score: number; totalMarks: number; percentage: number;
    passed: boolean | null; tabSwitchCount: number; liveSessionId: string | null; submittedAt: string | null; durationTakenSeconds: number | null;
};

const STATUS: Record<AttemptRow["status"], { label: string; cls: string }> = {
    IN_PROGRESS: { label: "চলছে", cls: "bg-blue-50 text-blue-700" },
    SUBMITTED: { label: "জমা", cls: "bg-emerald-50 text-emerald-700" },
    AWAITING_GRADING: { label: "গ্রেডিং বাকি", cls: "bg-amber-50 text-amber-700" },
    GRADED: { label: "গ্রেডেড", cls: "bg-emerald-50 text-emerald-700" },
};

function fmtDuration(s: number | null) {
    if (s == null) return "—";
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function AttemptsTable({ attempts, quizTitle }: { attempts: AttemptRow[]; quizTitle: string }) {
    const [q, setQ] = useState("");
    const rows = useMemo(() => {
        const s = q.trim().toLowerCase();
        return s ? attempts.filter((a) => `${a.studentName} ${a.studentRoll} ${a.studentBatchName}`.toLowerCase().includes(s)) : attempts;
    }, [attempts, q]);

    async function exportXlsx() {
        const XLSX = await import("xlsx");
        const data = rows.map((a) => ({
            Name: a.studentName, Roll: a.studentRoll, Batch: a.studentBatchName, Attempt: a.attemptNumber,
            Type: a.isPractice ? "Practice" : a.liveSessionId ? "Live" : "Real", Status: a.status,
            Score: a.score, Total: a.totalMarks, Percentage: Math.round(a.percentage * 10) / 10,
            Passed: a.passed == null ? "" : a.passed ? "Yes" : "No", "Tab switches": a.tabSwitchCount,
            "Duration (s)": a.durationTakenSeconds ?? "", Submitted: a.submittedAt ?? "",
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Attempts");
        XLSX.writeFile(wb, `${quizTitle.replace(/[^\wঀ-৿-]+/g, "_")}_results.xlsx`);
    }

    return (
        <section className={`${GLASS_PANEL} rounded-2xl p-5`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <h2 className="no-gradient font-bold text-slate-800 flex-1">সব অ্যাটেম্পট ({attempts.length})</h2>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="নাম / রোল / ব্যাচ খুঁজুন" className={`${fieldClass} sm:!w-60`} />
                <button onClick={exportXlsx} disabled={rows.length === 0} className={btnGhost}><Download className="h-3.5 w-3.5" /> Excel</button>
            </div>
            {rows.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">কোনো অ্যাটেম্পট নেই।</p> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                            <th className="py-2 pr-3">নাম</th><th className="pr-3">রোল</th><th className="pr-3">ব্যাচ</th><th className="pr-3">#</th><th className="pr-3">ধরন</th><th className="pr-3">স্ট্যাটাস</th><th className="pr-3 text-right">স্কোর</th><th className="pr-3 text-right">%</th><th className="pr-3 text-right">সময়</th><th className="pr-3 text-right">Tab</th><th>জমা</th>
                        </tr></thead>
                        <tbody>
                            {rows.map((a) => (
                                <tr key={a.id} className="border-b border-slate-50">
                                    <td className="py-2 pr-3 font-medium text-slate-800">{a.studentName}</td>
                                    <td className="pr-3 text-slate-500">{a.studentRoll}</td>
                                    <td className="pr-3 text-slate-500">{a.studentBatchName}</td>
                                    <td className="pr-3">{a.attemptNumber}</td>
                                    <td className="pr-3 text-slate-500">{a.isPractice ? "Practice" : a.liveSessionId ? "Live" : "Real"}</td>
                                    <td className="pr-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span></td>
                                    <td className="pr-3 text-right tabular-nums">{a.score}/{a.totalMarks}</td>
                                    <td className={`pr-3 text-right tabular-nums ${a.passed === true ? "text-emerald-600" : a.passed === false ? "text-red-500" : ""}`}>{a.percentage.toFixed(1)}</td>
                                    <td className="pr-3 text-right tabular-nums text-slate-500">{fmtDuration(a.durationTakenSeconds)}</td>
                                    <td className={`pr-3 text-right tabular-nums ${a.tabSwitchCount > 0 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>{a.tabSwitchCount}</td>
                                    <td className="text-slate-500">{formatDateTime(a.submittedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
