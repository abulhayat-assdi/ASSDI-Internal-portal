"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { AmbientOrbs, GLASS_PANEL } from "@/components/typing-exam/ui";
import QuizIntro, { type QuizIntroInfo } from "@/components/quiz-student/QuizIntro";
import QuizRunner, { type RunnerData } from "@/components/quiz-student/QuizRunner";
import { Spinner, quizErrorMessage } from "@/components/quiz-student/shared";

type Phase = "loading" | "intro" | "starting" | "running" | "error";

function QuizTakePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const practice = useSearchParams().get("practice") === "true";

    const [phase, setPhase] = useState<Phase>("loading");
    const [info, setInfo] = useState<QuizIntroInfo | null>(null);
    const [data, setData] = useState<RunnerData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const start = useCallback(async () => {
        setPhase("starting");
        try {
            const res = await fetch(`/api/student/quiz/${id}${practice ? "?practice=true" : ""}`);
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(quizErrorMessage(body.error));
                setPhase("error");
                return;
            }
            setData(body as RunnerData);
            setPhase("running");
        } catch {
            setError(quizErrorMessage(undefined));
            setPhase("error");
        }
    }, [id, practice]);

    // The list endpoint tells us (without starting an attempt) whether to show the intro or resume.
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch("/api/student/quiz");
                const list = res.ok ? await res.json() : [];
                const item = (Array.isArray(list) ? list : []).find((q: { id: string }) => q.id === id);
                if (!alive) return;
                if (!item) {
                    // Not in the visible list: let the detail route give the precise reason (closed / not-open ...).
                    start();
                    return;
                }
                if (item.inProgressAttemptId && !practice) {
                    start();
                    return;
                }
                setInfo(item);
                setPhase("intro");
            } catch {
                if (alive) start();
            }
        })();
        return () => {
            alive = false;
        };
    }, [id, practice, start]);

    return (
        <div className="pb-12">
            <AmbientOrbs />
            {phase === "loading" && <Spinner />}
            {phase === "error" && (
                <div className={`${GLASS_PANEL} rounded-2xl px-5 py-8 sm:p-10 text-center max-w-lg mx-auto`}>
                    <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-slate-700 font-medium">{error}</p>
                    <Link
                        href="/student-dashboard/quiz"
                        className="inline-block mt-5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                        কুইজ তালিকায় ফিরে যান
                    </Link>
                </div>
            )}
            {(phase === "intro" || phase === "starting") && info && (
                <QuizIntro info={info} practice={practice} starting={phase === "starting"} onStart={start} />
            )}
            {phase === "running" && data && (
                <QuizRunner
                    quizId={id}
                    data={data}
                    onSubmitted={(attemptId) => router.replace(`/student-dashboard/quiz/${id}/result/${attemptId}`)}
                />
            )}
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<Spinner />}>
            <QuizTakePage />
        </Suspense>
    );
}
