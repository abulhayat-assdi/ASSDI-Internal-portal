"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Keyboard, Timer, Repeat2, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { AmbientOrbs, GLASS_PANEL, RESULT_META, fadeUp, staggerContainer, popIn } from "@/components/typing-exam/ui";

interface TypingExamListItem {
    id: string;
    title: string;
    description: string;
    durationSeconds: number;
    attemptsUsed: number;
    lastResult?: { wpm: number; accuracy: number; result: "PASS" | "AVERAGE" | "FAIL" };
}

function formatDuration(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    if (minutes === 0) return `${rest} সেকেন্ড`;
    if (rest === 0) return `${minutes} মিনিট`;
    return `${minutes} মিনিট ${rest} সেকেন্ড`;
}

export default function StudentTypingExamListPage() {
    const [exams, setExams] = useState<TypingExamListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let mounted = true;
        fetch("/api/student/typing-exam")
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load");
                return res.json();
            })
            .then((data) => {
                if (mounted) setExams(data);
            })
            .catch(() => {
                if (mounted) setError(true);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <AmbientOrbs />

            <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex items-center gap-3"
            >
                <div className="w-1 h-10 bg-brand-600 rounded-full" />
                <div>
                    <h1 className="no-gradient text-3xl font-bold text-slate-800">টাইপিং পরীক্ষা</h1>
                    <p className="text-slate-500 mt-1 text-sm">আপনার ব্যাচের জন্য চলমান টাইপিং পরীক্ষাসমূহ।</p>
                </div>
            </motion.div>

            {loading && (
                <div className="text-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" />
                    <p className="text-slate-400 mt-3 text-sm">লোড হচ্ছে...</p>
                </div>
            )}

            {!loading && error && (
                <div className={`${GLASS_PANEL} rounded-2xl p-12 text-center`}>
                    <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" strokeWidth={1.5} />
                    <h3 className="text-lg font-bold text-slate-800">লোড হয়নি</h3>
                    <p className="text-slate-500 mt-1 text-sm">পরীক্ষার তথ্য লোড করতে সমস্যা হয়েছে। পেজ রিফ্রেশ করুন।</p>
                </div>
            )}

            {!loading && !error && exams.length === 0 && (
                <motion.div
                    initial={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    className={`${GLASS_PANEL} rounded-2xl p-14 text-center`}
                >
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Keyboard className="h-8 w-8" strokeWidth={1.5} />
                    </div>
                    <p className="text-slate-500 text-sm">এই মুহূর্তে আপনার ব্যাচের জন্য কোনো পরীক্ষা চলমান নেই।</p>
                </motion.div>
            )}

            {!loading && !error && exams.length > 0 && (
                <motion.div
                    variants={reduceMotion ? undefined : staggerContainer}
                    initial={reduceMotion ? undefined : "hidden"}
                    animate={reduceMotion ? undefined : "show"}
                    className="grid grid-cols-1 md:grid-cols-2 gap-5"
                >
                    {exams.map((exam) => {
                        const resultMeta = exam.lastResult ? RESULT_META[exam.lastResult.result] : null;
                        return (
                            <motion.div
                                key={exam.id}
                                variants={reduceMotion ? undefined : fadeUp}
                                whileHover={reduceMotion ? undefined : { y: -3, transition: { duration: 0.2 } }}
                                className={`${GLASS_PANEL} rounded-2xl p-6 flex flex-col gap-4 transition-shadow hover:shadow-[0_16px_40px_rgba(15,23,42,0.1)]`}
                            >
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{exam.title}</h3>
                                    {exam.description && (
                                        <p className="text-sm text-slate-500 mt-1">{exam.description}</p>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1">
                                        <Timer className="h-3.5 w-3.5" strokeWidth={2} />
                                        {formatDuration(exam.durationSeconds)}
                                    </span>
                                    {exam.attemptsUsed > 0 && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1">
                                            <Repeat2 className="h-3.5 w-3.5" strokeWidth={2} />
                                            চেষ্টা: {exam.attemptsUsed} বার হয়েছে
                                        </span>
                                    )}
                                </div>

                                {resultMeta && exam.lastResult && (
                                    <motion.div
                                        variants={reduceMotion ? undefined : popIn}
                                        className={`inline-flex items-center gap-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold ${resultMeta.badge}`}
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                                        সর্বশেষ ফলাফল: {resultMeta.label} · {exam.lastResult.wpm} WPM · {exam.lastResult.accuracy}%
                                    </motion.div>
                                )}

                                <div className="pt-2 border-t border-slate-100">
                                    <Link
                                        href={`/student-dashboard/typing-exam/${exam.id}`}
                                        className="group inline-flex items-center justify-center gap-1.5 py-2.5 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-600/20 transition-all"
                                    >
                                        {exam.attemptsUsed > 0 ? "আবার শুরু করুন" : "শুরু করুন"}
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                                    </Link>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}
        </div>
    );
}
