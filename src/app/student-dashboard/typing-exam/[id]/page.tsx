"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Trophy, TrendingUp, RotateCcw } from "lucide-react";
import ExamRunner from "@/components/typing-exam/ExamRunner";
import { AmbientOrbs, GLASS_PANEL, RESULT_META, modalPanel } from "@/components/typing-exam/ui";

interface ExamDetail {
    id: string;
    title: string;
    examText: string;
    durationSeconds: number;
}

interface AttemptResult {
    wpm: number;
    accuracy: number;
    result: "PASS" | "AVERAGE" | "FAIL";
}

const RESULT_ICON = { PASS: Trophy, AVERAGE: TrendingUp, FAIL: RotateCcw } as const;

export default function StudentTypingExamDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const reduceMotion = useReducedMotion();

    const [exam, setExam] = useState<ExamDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [result, setResult] = useState<AttemptResult | null>(null);

    useEffect(() => {
        let mounted = true;
        fetch(`/api/student/typing-exam/${id}`)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "এই পরীক্ষাটি এখন আপনার জন্য উপলব্ধ নয়।");
                return data;
            })
            .then((data) => {
                if (mounted) setExam(data);
            })
            .catch((err) => {
                if (mounted) setLoadError(err.message);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [id]);

    const handleSubmit = async (payload: { typedText: string; elapsedSeconds: number }) => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch(`/api/student/typing-exam/${id}/attempt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "জমা দিতে সমস্যা হয়েছে।");
            setResult(data);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "জমা দিতে সমস্যা হয়েছে।");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" />
                <p className="text-slate-400 mt-3 text-sm">লোড হচ্ছে...</p>
            </div>
        );
    }

    if (loadError || !exam) {
        return (
            <div className="max-w-2xl mx-auto pb-12">
                <AmbientOrbs />
                <div className={`${GLASS_PANEL} rounded-2xl p-12 text-center`}>
                    <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" strokeWidth={1.5} />
                    <h3 className="text-lg font-bold text-slate-800">পরীক্ষাটি খোলা যায়নি</h3>
                    <p className="text-slate-500 mt-1 text-sm">{loadError || "এই পরীক্ষাটি এখন আপনার জন্য উপলব্ধ নয়।"}</p>
                    <button
                        onClick={() => router.push("/student-dashboard/typing-exam")}
                        className="cursor-pointer mt-6 inline-flex items-center justify-center gap-1.5 py-2.5 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-600/20 transition-colors"
                    >
                        তালিকায় ফিরে যান
                    </button>
                </div>
            </div>
        );
    }

    const ResultIcon = result ? RESULT_ICON[result.result] : null;
    const resultMeta = result ? RESULT_META[result.result] : null;

    return (
        <div className="max-w-3xl mx-auto pb-12 space-y-6">
            <AmbientOrbs />

            <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex items-center gap-3"
            >
                <div className="w-1 h-10 bg-brand-600 rounded-full" />
                <div>
                    <h1 className="no-gradient text-2xl font-bold text-slate-800">{exam.title}</h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        নির্দেশনা মনোযোগ সহকারে পড়ুন, তারপর নিচের অনুচ্ছেদটি যত দ্রুত ও নির্ভুলভাবে সম্ভব টাইপ করুন।
                    </p>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {!result ? (
                    <motion.div key="runner" exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }} className="space-y-4">
                        <ExamRunner
                            examText={exam.examText}
                            durationSeconds={exam.durationSeconds}
                            onSubmit={handleSubmit}
                            submitting={submitting}
                        />
                        {submitError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {submitError}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="result"
                        variants={reduceMotion ? undefined : modalPanel}
                        initial={reduceMotion ? undefined : "hidden"}
                        animate={reduceMotion ? undefined : "show"}
                        className={`${GLASS_PANEL} rounded-2xl p-8 text-center space-y-5`}
                    >
                        <motion.div
                            initial={reduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${resultMeta?.badge}`}
                        >
                            {ResultIcon && <ResultIcon className="h-8 w-8" strokeWidth={1.75} />}
                        </motion.div>
                        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${resultMeta?.badge}`}>
                            {resultMeta?.label}
                        </div>
                        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                            <motion.div
                                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.3 }}
                                className="rounded-xl bg-slate-50/80 p-5"
                            >
                                <p className="text-3xl font-bold text-slate-800">{result.wpm}</p>
                                <p className="text-xs text-slate-500 mt-1">WPM</p>
                            </motion.div>
                            <motion.div
                                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.28, duration: 0.3 }}
                                className="rounded-xl bg-slate-50/80 p-5"
                            >
                                <p className="text-3xl font-bold text-slate-800">{result.accuracy}%</p>
                                <p className="text-xs text-slate-500 mt-1">Accuracy</p>
                            </motion.div>
                        </div>
                        <Link
                            href="/student-dashboard/typing-exam"
                            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-600/20 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
                            পরীক্ষার তালিকায় ফিরে যান
                        </Link>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
