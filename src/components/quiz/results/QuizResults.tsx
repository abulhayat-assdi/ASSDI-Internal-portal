"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Megaphone, Radio, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { AmbientOrbs, GLASS_PANEL } from "@/components/typing-exam/ui";
import { formatDateTime } from "../types";
import { btnGhost } from "../ui";
import AnalyticsPanel, { type Analytics } from "./AnalyticsPanel";
import AttemptsTable, { type AttemptRow } from "./AttemptsTable";
import GradingQueue, { type GradingAttempt } from "./GradingQueue";

type QuizInfo = {
    id: string; title: string; isActive: boolean; resultReleaseMode: "IMMEDIATE" | "HELD";
    resultReleaseAt: string | null; resultsReleasedAt: string | null; _count: { attempts: number };
};

export default function QuizResults({ quizId }: { quizId: string }) {
    const [quiz, setQuiz] = useState<QuizInfo | null>(null);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [attempts, setAttempts] = useState<AttemptRow[]>([]);
    const [grading, setGrading] = useState<GradingAttempt[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [releasing, setReleasing] = useState(false);

    const load = useCallback(async () => {
        const [q, a, t, g] = await Promise.all([
            fetch(`/api/quiz/${quizId}`),
            fetch(`/api/quiz/${quizId}/analytics`),
            fetch(`/api/quiz/${quizId}/attempts`),
            fetch(`/api/quiz/${quizId}/grading`),
        ]);
        if (!q.ok) {
            setError((await q.json().catch(() => ({}))).error || `Error ${q.status}`);
            setLoading(false);
            return;
        }
        setQuiz(await q.json());
        if (a.ok) setAnalytics(await a.json());
        if (t.ok) setAttempts(await t.json());
        if (g.ok) setGrading(await g.json());
        setLoading(false);
    }, [quizId]);

    useEffect(() => { load(); }, [load]);

    async function release() {
        if (!confirm("রেজাল্ট এখনই স্টুডেন্টদের জন্য প্রকাশ করবেন?")) return;
        setReleasing(true);
        const res = await fetch(`/api/quiz/${quizId}/release-results`, { method: "POST" });
        setReleasing(false);
        if (res.ok) { toast.success("রেজাল্ট প্রকাশিত হয়েছে"); load(); }
        else toast.error("প্রকাশ করা যায়নি");
    }

    if (loading) return <div className="text-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" /></div>;
    if (error || !quiz) return <div className="p-6 max-w-3xl mx-auto"><div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200"><AlertTriangle className="h-4 w-4" /> {error || "Not found"}</div></div>;

    const released = Boolean(quiz.resultsReleasedAt);

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
            <AmbientOrbs />
            <div>
                <Link href="/dashboard/quiz" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3"><ArrowLeft className="h-4 w-4" /> কুইজ লিস্ট</Link>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="no-gradient text-2xl font-bold text-slate-800">{quiz.title}</h1>
                        <p className="text-sm text-slate-500 mt-1">{quiz.isActive ? "Published" : "Draft"} · {quiz._count.attempts} অ্যাটেম্পট</p>
                    </div>
                    <Link href={`/dashboard/quiz/${quiz.id}/edit`} className={btnGhost}><Pencil className="h-3.5 w-3.5" /> এডিট</Link>
                </div>
            </div>

            <div className={`${GLASS_PANEL} rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
                <Megaphone className="h-5 w-5 text-brand-600 shrink-0" />
                <div className="flex-1 text-sm text-slate-600">
                    {quiz.resultReleaseMode === "IMMEDIATE"
                        ? "রেজাল্ট জমা দেওয়ার সাথে সাথেই স্টুডেন্টরা দেখতে পায়।"
                        : released
                          ? <>রেজাল্ট প্রকাশিত — {formatDateTime(quiz.resultsReleasedAt)}</>
                          : <>রেজাল্ট আটকে আছে{quiz.resultReleaseAt ? <> — স্বয়ংক্রিয় প্রকাশ: {formatDateTime(quiz.resultReleaseAt)}</> : null}।</>}
                </div>
                {quiz.resultReleaseMode === "HELD" && !released && (
                    <button onClick={release} disabled={releasing} className="cursor-pointer inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl"><Radio className="h-4 w-4" /> এখনই Release করুন</button>
                )}
            </div>

            {grading.length > 0 && <GradingQueue items={grading} quizId={quizId} onGraded={load} />}
            {analytics && <AnalyticsPanel data={analytics} />}
            <AttemptsTable attempts={attempts} quizTitle={quiz.title} />
        </div>
    );
}
