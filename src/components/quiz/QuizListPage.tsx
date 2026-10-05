"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, BarChart3, Power, Trash2, Pencil, Radio, AlertTriangle, HelpCircle, CalendarClock } from "lucide-react";
import { AmbientOrbs, GLASS_PANEL, fadeUp, staggerContainer } from "@/components/typing-exam/ui";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, type QuizListItem } from "./types";
import { btnPrimary } from "./ui";

/** Shared by /dashboard/quiz (own quizzes) and /dashboard/admin/manage-quiz (all course quizzes). */
export default function QuizListPage({ scope }: { scope: "mine" | "all" }) {
    const router = useRouter();
    const reduceMotion = useReducedMotion();
    const { user, loading: authLoading } = useAuth();
    const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (scope === "mine" && !user) return;
        setError("");
        const qs = scope === "mine" && user ? `?teacherUid=${encodeURIComponent(user.id)}` : "";
        const res = await fetch(`/api/quiz${qs}`);
        if (res.ok) setQuizzes(await res.json());
        else setError((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
        setLoading(false);
    }, [scope, user]);

    useEffect(() => {
        if (!authLoading) load();
    }, [authLoading, load]);

    async function togglePublish(q: QuizListItem) {
        setBusyId(q.id);
        const res = await fetch(`/api/quiz/${q.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !q.isActive }),
        });
        if (!res.ok) setError((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
        setBusyId(null);
        load();
    }

    async function remove(q: QuizListItem) {
        if (!confirm(`"${q.title}" কুইজটি এবং এর সব অ্যাটেম্পট স্থায়ীভাবে মুছে ফেলা হবে। আপনি কি নিশ্চিত?`)) return;
        setBusyId(q.id);
        await fetch(`/api/quiz/${q.id}`, { method: "DELETE" });
        setBusyId(null);
        load();
    }

    async function hostLive(q: QuizListItem) {
        setBusyId(q.id);
        const res = await fetch(`/api/quiz/${q.id}/live`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        setBusyId(null);
        if (!res.ok) {
            setError(data.error || `Error ${res.status}`);
            return;
        }
        router.push(`/dashboard/quiz/live/${data.id}`);
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <AmbientOrbs />
            <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
                <div>
                    <h1 className="no-gradient text-2xl font-bold text-slate-800">{scope === "all" ? "Manage Quiz" : "কুইজ (Quiz)"}</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {scope === "all" ? "কোর্সের সব কুইজ — দেখুন, এডিট করুন, রেজাল্ট ও অ্যানালিটিক্স।" : "MCQ কুইজ তৈরি করুন, লাইভ হোস্ট করুন এবং রেজাল্ট দেখুন।"}
                    </p>
                </div>
                <Link href="/dashboard/quiz/new" className={btnPrimary}>
                    <Plus className="h-4 w-4" strokeWidth={2.5} /> নতুন কুইজ
                </Link>
            </motion.div>

            {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
            )}

            {loading ? (
                <div className="text-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" /></div>
            ) : quizzes.length === 0 ? (
                <div className={`${GLASS_PANEL} rounded-2xl p-14 text-center`}>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><HelpCircle className="h-8 w-8" strokeWidth={1.5} /></div>
                    <p className="text-slate-500 text-sm">এখনো কোনো কুইজ তৈরি হয়নি।</p>
                </div>
            ) : (
                <motion.div variants={reduceMotion ? undefined : staggerContainer} initial={reduceMotion ? undefined : "hidden"} animate={reduceMotion ? undefined : "show"} className="space-y-3">
                    {quizzes.map((q) => (
                        <motion.div
                            key={q.id}
                            variants={reduceMotion ? undefined : fadeUp}
                            className={`${GLASS_PANEL} rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-3`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-800">{q.title}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                        {q.isActive ? "Published" : "Draft"}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{q._count.questions} প্রশ্ন</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{q._count.attempts} অ্যাটেম্পট</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 truncate">
                                    ব্যাচ: {q.batchNames.includes("all") ? "সব ব্যাচ" : q.batchNames.join(", ") || "—"}
                                    {scope === "all" && <> · তৈরি করেছেন: {q.createdByName || "—"}</>}
                                </p>
                                {(q.scheduleStart || q.scheduleEnd) && (
                                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                        <CalendarClock className="h-3 w-3" /> {formatDateTime(q.scheduleStart)} → {formatDateTime(q.scheduleEnd)}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button disabled={busyId === q.id} onClick={() => hostLive(q)} className="cursor-pointer flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50">
                                    <Radio className="h-3.5 w-3.5" /> Host live
                                </button>
                                <Link href={`/dashboard/quiz/${q.id}`} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">
                                    <BarChart3 className="h-3.5 w-3.5" /> রেজাল্ট
                                </Link>
                                <Link href={`/dashboard/quiz/${q.id}/edit`} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">
                                    <Pencil className="h-3.5 w-3.5" /> এডিট
                                </Link>
                                <button
                                    disabled={busyId === q.id}
                                    onClick={() => togglePublish(q)}
                                    className={`cursor-pointer flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium disabled:opacity-50 ${q.isActive ? "border-red-200 text-red-500 hover:bg-red-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                                >
                                    <Power className="h-3.5 w-3.5" /> {q.isActive ? "Unpublish" : "Publish"}
                                </button>
                                <button disabled={busyId === q.id} onClick={() => remove(q)} className="cursor-pointer flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 font-medium">
                                    <Trash2 className="h-3.5 w-3.5" /> মুছুন
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
