"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { HelpCircle, Timer, Repeat2, AlertTriangle, ArrowRight, CalendarClock, Play, Dumbbell } from "lucide-react";
import { AmbientOrbs, GLASS_PANEL, fadeUp, staggerContainer } from "@/components/typing-exam/ui";
import JoinLiveBox from "@/components/quiz-student/JoinLiveBox";
import { Spinner, formatDuration } from "@/components/quiz-student/shared";

interface QuizListItem {
    id: string;
    title: string;
    descriptionHtml: string;
    durationSeconds: number | null;
    maxAttempts: number;
    attemptsUsed: number;
    practiceModeAllowed: boolean;
    scheduleEnd: string | null;
    inProgressAttemptId: string | null;
    questionCount: number;
}

function stripTags(html: string) {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function StudentQuizListPage() {
    const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let mounted = true;
        fetch("/api/student/quiz")
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load");
                return res.json();
            })
            .then((data) => {
                if (mounted) setQuizzes(data);
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

            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-brand-600 rounded-full" />
                <div>
                    <h1 className="no-gradient text-2xl sm:text-3xl font-bold text-slate-800">কুইজ</h1>
                    <p className="text-slate-500 mt-1 text-sm">আপনার ব্যাচের জন্য চলমান কুইজসমূহ।</p>
                </div>
            </div>

            <JoinLiveBox />

            {loading && <Spinner />}

            {!loading && error && (
                <div className={`${GLASS_PANEL} rounded-2xl p-12 text-center`}>
                    <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" strokeWidth={1.5} />
                    <h3 className="text-lg font-bold text-slate-800">লোড হয়নি</h3>
                    <p className="text-slate-500 mt-1 text-sm">কুইজের তথ্য লোড করতে সমস্যা হয়েছে। পেজ রিফ্রেশ করুন।</p>
                </div>
            )}

            {!loading && !error && quizzes.length === 0 && (
                <div className={`${GLASS_PANEL} rounded-2xl p-12 text-center`}>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <HelpCircle className="h-8 w-8" strokeWidth={1.5} />
                    </div>
                    <p className="text-slate-500 text-sm">এই মুহূর্তে আপনার ব্যাচের জন্য কোনো কুইজ চলমান নেই।</p>
                </div>
            )}

            {!loading && !error && quizzes.length > 0 && (
                <motion.div
                    variants={reduceMotion ? undefined : staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid gap-4 sm:grid-cols-2"
                >
                    {quizzes.map((quiz) => {
                        const exhausted = quiz.attemptsUsed >= quiz.maxAttempts && !quiz.inProgressAttemptId;
                        const desc = stripTags(quiz.descriptionHtml);
                        return (
                            <motion.div
                                key={quiz.id}
                                variants={reduceMotion ? undefined : fadeUp}
                                className={`${GLASS_PANEL} rounded-2xl p-5 flex flex-col gap-3`}
                            >
                                <h3 className="text-lg font-bold text-slate-800">{quiz.title}</h3>
                                {desc && <p className="text-sm text-slate-500 line-clamp-2">{desc}</p>}
                                <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1">
                                        <HelpCircle className="h-3.5 w-3.5" /> {quiz.questionCount} টি প্রশ্ন
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1">
                                        <Timer className="h-3.5 w-3.5" />
                                        {quiz.durationSeconds ? formatDuration(quiz.durationSeconds) : "সময়সীমা নেই"}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1">
                                        <Repeat2 className="h-3.5 w-3.5" /> চেষ্টা: {quiz.attemptsUsed}/{quiz.maxAttempts}
                                    </span>
                                    {quiz.scheduleEnd && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-3 py-1">
                                            <CalendarClock className="h-3.5 w-3.5" />
                                            শেষ: {new Date(quiz.scheduleEnd).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" })}
                                        </span>
                                    )}
                                </div>
                                <div className="pt-3 mt-auto border-t border-slate-100 flex flex-wrap gap-2">
                                    {quiz.inProgressAttemptId ? (
                                        <Link
                                            href={`/student-dashboard/quiz/${quiz.id}`}
                                            className="inline-flex items-center gap-1.5 py-2.5 px-5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all"
                                        >
                                            <Play className="h-4 w-4" /> চালিয়ে যান
                                        </Link>
                                    ) : exhausted ? (
                                        <span className="inline-flex items-center py-2.5 px-4 text-sm font-medium text-slate-500 bg-slate-100 rounded-xl">
                                            সব চেষ্টা শেষ
                                        </span>
                                    ) : (
                                        <Link
                                            href={`/student-dashboard/quiz/${quiz.id}`}
                                            className="group inline-flex items-center gap-1.5 py-2.5 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-600/20 transition-all"
                                        >
                                            {quiz.attemptsUsed > 0 ? "আবার দিন" : "শুরু করুন"}
                                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                                        </Link>
                                    )}
                                    {quiz.practiceModeAllowed && !quiz.inProgressAttemptId && (
                                        <Link
                                            href={`/student-dashboard/quiz/${quiz.id}?practice=true`}
                                            className="inline-flex items-center gap-1.5 py-2.5 px-4 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-all"
                                        >
                                            <Dumbbell className="h-4 w-4" /> প্র্যাকটিস
                                        </Link>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}
        </div>
    );
}
