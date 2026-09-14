"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import ExamRunner, { ExamRunnerSubmitPayload } from "@/components/typing-exam/ExamRunner";
import ExamResultPanel, { ExamResultPanelData } from "@/components/typing-exam/ExamResultPanel";
import { AmbientOrbs, GLASS_PANEL } from "@/components/typing-exam/ui";

interface ExamDetail {
    id: string;
    title: string;
    examText: string;
    durationSeconds: number;
    attemptsUsed: number;
}

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
    const [result, setResult] = useState<ExamResultPanelData | null>(null);
    // Bumped on retry to force ExamRunner to remount fresh (clears its
    // internal phase/typedText state and re-reads the latest attemptsUsed).
    const [runnerKey, setRunnerKey] = useState(0);

    const loadExam = async (mountedRef?: { current: boolean }) => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetch(`/api/student/typing-exam/${id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "এই পরীক্ষাটি এখন আপনার জন্য উপলব্ধ নয়।");
            if (!mountedRef || mountedRef.current) setExam(data as ExamDetail);
        } catch (err) {
            if (!mountedRef || mountedRef.current) {
                setLoadError(err instanceof Error ? err.message : "এই পরীক্ষাটি এখন আপনার জন্য উপলব্ধ নয়।");
            }
        } finally {
            if (!mountedRef || mountedRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        const mountedRef = { current: true };
        loadExam(mountedRef);
        return () => {
            mountedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const verifyRetryPassword = async (password: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/student/typing-exam/${id}/retry-check`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            return res.ok;
        } catch {
            return false;
        }
    };

    const handleSubmit = async (payload: ExamRunnerSubmitPayload) => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch(`/api/student/typing-exam/${id}/attempt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.status === 401 && data.needsPassword) {
                setSubmitError("পাসওয়ার্ড যাচাই ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
                return;
            }
            if (!res.ok) throw new Error(data.error || "জমা দিতে সমস্যা হয়েছে।");
            setResult(data);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "জমা দিতে সমস্যা হয়েছে।");
        } finally {
            setSubmitting(false);
        }
    };

    // "Try Again" just clears the graded result and re-fetches the exam
    // detail (for a fresh attemptsUsed), which re-mounts <ExamRunner> at its
    // "ready" phase. ExamRunner's own ExamReadyScreen already shows the
    // retry-password gate whenever attemptsUsed > 0 — no separate
    // page-level password prompt is needed.
    const handleRetryClick = async () => {
        setSubmitError(null);
        setResult(null);
        setRunnerKey((k) => k + 1);
        await loadExam();
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
                            key={runnerKey}
                            examText={exam.examText}
                            durationSeconds={exam.durationSeconds}
                            attemptsUsed={exam.attemptsUsed}
                            onVerifyRetryPassword={verifyRetryPassword}
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
                    <motion.div key="result" exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}>
                        <ExamResultPanel result={result} variant="student" onRetry={handleRetryClick} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
