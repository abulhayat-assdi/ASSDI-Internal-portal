"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TypingExamListItem {
    id: string;
    title: string;
    description: string;
    durationSeconds: number;
    maxAttempts: number;
    attemptsUsed: number;
    canAttempt: boolean;
    lastResult?: { wpm: number; accuracy: number; result: "PASS" | "AVERAGE" | "FAIL" };
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
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full" />
                <div>
                    <h1 className="text-3xl font-bold text-[#1f2937]">টাইপিং পরীক্ষা</h1>
                    <p className="text-[#6b7280] mt-1 text-sm">আপনার ব্যাচের জন্য চলমান টাইপিং পরীক্ষাসমূহ।</p>
                </div>
            </div>

            {loading && (
                <div className="text-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669] mx-auto" />
                    <p className="text-gray-500 mt-3 text-sm">লোড হচ্ছে...</p>
                </div>
            )}

            {!loading && error && (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h3 className="text-lg font-bold text-gray-900">লোড হয়নি</h3>
                    <p className="text-gray-500 mt-1 text-sm">পরীক্ষার তথ্য লোড করতে সমস্যা হয়েছে। পেজ রিফ্রেশ করুন।</p>
                </div>
            )}

            {!loading && !error && exams.length === 0 && (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                    <div className="text-5xl mb-4">⌨️</div>
                    <p className="text-gray-500 text-sm">এই মুহূর্তে আপনার ব্যাচের জন্য কোনো পরীক্ষা চলমান নেই।</p>
                </div>
            )}

            {!loading && !error && exams.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {exams.map((exam) => (
                        <div
                            key={exam.id}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4"
                        >
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">{exam.title}</h3>
                                {exam.description && (
                                    <p className="text-sm text-gray-500 mt-1">{exam.description}</p>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                <span>⏱️ সময়: {formatDuration(exam.durationSeconds)}</span>
                                <span>
                                    🔁 চেষ্টা: {exam.attemptsUsed}/{exam.maxAttempts}
                                </span>
                            </div>

                            {exam.lastResult && (
                                <div
                                    className={`inline-flex items-center gap-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                                        resultBadgeClass[exam.lastResult.result]
                                    }`}
                                >
                                    সর্বশেষ ফলাফল: {resultLabel[exam.lastResult.result]} · {exam.lastResult.wpm} WPM ·{" "}
                                    {exam.lastResult.accuracy}%
                                </div>
                            )}

                            <div className="pt-2 border-t border-gray-50">
                                {exam.canAttempt ? (
                                    <Link
                                        href={`/student-dashboard/typing-exam/${exam.id}`}
                                        className="inline-flex items-center justify-center gap-1.5 py-2 px-5 text-sm font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors"
                                    >
                                        শুরু করুন
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 py-2 px-5 text-sm font-semibold text-gray-500 bg-gray-100 rounded-lg">
                                        আপনার সব চেষ্টা শেষ হয়ে গেছে
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
