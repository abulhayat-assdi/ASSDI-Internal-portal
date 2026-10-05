"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Hourglass, XCircle, Timer, Eye } from "lucide-react";
import { AmbientOrbs, GLASS_PANEL } from "@/components/typing-exam/ui";
import ResultReview, { type ReviewItem } from "@/components/quiz-student/ResultReview";
import ResultLeaderboard from "@/components/quiz-student/ResultLeaderboard";
import { Spinner, formatDuration } from "@/components/quiz-student/shared";

type ResultData =
    | { released: false; status: string }
    | {
          released: true;
          optionLabelStyle?: "LETTERS" | "NUMBERS" | "ROMAN";
          status: string;
          score: number;
          totalMarks: number;
          percentage: number;
          passed: boolean | null;
          tabSwitchCount: number;
          durationTakenSeconds: number | null;
          review: ReviewItem[];
      };

const round1 = (n: number) => Math.round(n * 10) / 10;

export default function QuizResultPage() {
    const { id, attemptId } = useParams<{ id: string; attemptId: string }>();
    const [data, setData] = useState<ResultData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        fetch(`/api/student/quiz/${id}/attempt/${attemptId}/result`)
            .then(async (res) => {
                const body = await res.json().catch(() => ({}));
                if (!alive) return;
                if (!res.ok) {
                    setError(
                        body.error === "not-submitted"
                            ? "এই চেষ্টাটি এখনো জমা দেওয়া হয়নি।"
                            : "ফলাফল পাওয়া যায়নি।"
                    );
                    return;
                }
                setData(body as ResultData);
            })
            .catch(() => alive && setError("ফলাফল লোড করতে সমস্যা হয়েছে।"));
        return () => {
            alive = false;
        };
    }, [id, attemptId]);

    const back = (
        <Link href="/student-dashboard/quiz" className="inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
            কুইজ তালিকায় ফিরে যান
        </Link>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-5 pb-12">
            <AmbientOrbs />
            {!data && !error && <Spinner />}

            {error && (
                <div className={`${GLASS_PANEL} rounded-2xl p-10 text-center space-y-4`}>
                    <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" strokeWidth={1.5} />
                    <p className="text-slate-700">{error}</p>
                    {back}
                </div>
            )}

            {data && !data.released && (
                <div className={`${GLASS_PANEL} rounded-2xl p-10 text-center space-y-4`}>
                    <Hourglass className="h-10 w-10 text-brand-600 mx-auto" strokeWidth={1.5} />
                    <h1 className="no-gradient text-xl font-bold text-slate-800">আপনার কুইজ জমা হয়েছে</h1>
                    <p className="text-slate-500 text-sm">ফলাফল শীঘ্রই প্রকাশ করা হবে। প্রকাশের পর এখানে এসে দেখতে পারবেন।</p>
                    {back}
                </div>
            )}

            {data && data.released && (
                <>
                    <div className={`${GLASS_PANEL} rounded-2xl p-6 text-center space-y-3`}>
                        {data.passed === true && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" /> পাস
                            </span>
                        )}
                        {data.passed === false && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                                <XCircle className="h-4 w-4" /> ফেইল
                            </span>
                        )}
                        <p className="text-5xl font-extrabold text-slate-800 tabular-nums">
                            {round1(data.score)}
                            <span className="text-2xl text-slate-400"> / {round1(data.totalMarks)}</span>
                        </p>
                        <p className="text-lg font-semibold text-brand-600">{round1(data.percentage)}%</p>
                        <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-600">
                            {data.durationTakenSeconds != null && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                                    <Timer className="h-3.5 w-3.5" /> {formatDuration(data.durationTakenSeconds)}
                                </span>
                            )}
                            {data.tabSwitchCount > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-3 py-1">
                                    <Eye className="h-3.5 w-3.5" /> ট্যাব পরিবর্তন: {data.tabSwitchCount}
                                </span>
                            )}
                        </div>
                        {data.status === "AWAITING_GRADING" && (
                            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                                কিছু উত্তর শিক্ষক এখনো গ্রেড করেননি, তাই চূড়ান্ত স্কোর বদলাতে পারে।
                            </p>
                        )}
                    </div>

                    <ResultLeaderboard quizId={id} />

                    <h2 className="no-gradient text-lg font-bold text-slate-800">উত্তর পর্যালোচনা</h2>
                    <ResultReview review={data.review} labelStyle={data.optionLabelStyle} />
                    <div className="text-center pt-2">{back}</div>
                </>
            )}
        </div>
    );
}
