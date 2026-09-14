"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ExamRunner from "@/components/typing-exam/ExamRunner";

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

const resultBadgeClass: Record<string, string> = {
    PASS: "bg-emerald-50 text-emerald-700 border-emerald-200",
    AVERAGE: "bg-amber-50 text-amber-700 border-amber-200",
    FAIL: "bg-red-50 text-red-700 border-red-200",
};

const resultLabel: Record<string, string> = {
    PASS: "পাস",
    AVERAGE: "গড়",
    FAIL: "ফেল",
};

export default function StudentTypingExamDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669] mx-auto" />
                <p className="text-gray-500 mt-3 text-sm">লোড হচ্ছে...</p>
            </div>
        );
    }

    if (loadError || !exam) {
        return (
            <div className="max-w-2xl mx-auto pb-12">
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h3 className="text-lg font-bold text-gray-900">পরীক্ষাটি খোলা যায়নি</h3>
                    <p className="text-gray-500 mt-1 text-sm">{loadError || "এই পরীক্ষাটি এখন আপনার জন্য উপলব্ধ নয়।"}</p>
                    <button
                        onClick={() => router.push("/student-dashboard/typing-exam")}
                        className="mt-6 inline-flex items-center justify-center gap-1.5 py-2 px-5 text-sm font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors"
                    >
                        তালিকায় ফিরে যান
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-12 space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full" />
                <div>
                    <h1 className="text-2xl font-bold text-[#1f2937]">{exam.title}</h1>
                    <p className="text-[#6b7280] mt-1 text-sm">
                        নির্দেশনা মনোযোগ সহকারে পড়ুন, তারপর নিচের অনুচ্ছেদটি যত দ্রুত ও নির্ভুলভাবে সম্ভব টাইপ করুন।
                    </p>
                </div>
            </div>

            {!result && (
                <>
                    <ExamRunner
                        examText={exam.examText}
                        durationSeconds={exam.durationSeconds}
                        onSubmit={handleSubmit}
                        submitting={submitting}
                    />
                    {submitError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {submitError}
                        </div>
                    )}
                </>
            )}

            {result && (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center space-y-5">
                    <div
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${
                            resultBadgeClass[result.result]
                        }`}
                    >
                        {resultLabel[result.result]}
                    </div>
                    <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                        <div className="rounded-xl bg-gray-50 p-5">
                            <p className="text-3xl font-bold text-gray-900">{result.wpm}</p>
                            <p className="text-xs text-gray-500 mt-1">WPM</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-5">
                            <p className="text-3xl font-bold text-gray-900">{result.accuracy}%</p>
                            <p className="text-xs text-gray-500 mt-1">Accuracy</p>
                        </div>
                    </div>
                    <Link
                        href="/student-dashboard/typing-exam"
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-5 text-sm font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors"
                    >
                        পরীক্ষার তালিকায় ফিরে যান
                    </Link>
                </div>
            )}
        </div>
    );
}
