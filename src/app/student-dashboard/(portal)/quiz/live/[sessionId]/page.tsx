"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/quiz-student/shared";
import { LiveFinished, LiveLobby, LiveQuestion, LiveReveal, type LiveState } from "@/components/quiz-student/LiveScreens";

const POLL_MS = 1200;

export default function LiveQuizPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [state, setState] = useState<LiveState | null>(null);
    const [deadline, setDeadline] = useState(0);
    const [fatal, setFatal] = useState<string | null>(null);
    const [answerError, setAnswerError] = useState<string | null>(null);
    const [lockedFor, setLockedFor] = useState<string | null>(null);
    const failures = useRef(0);
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const poll = async () => {
            try {
                const res = await fetch(`/api/student/quiz/live/${sessionId}`, { cache: "no-store" });
                if (!alive) return;
                if (res.status === 404 || res.status === 401) {
                    setFatal(res.status === 404 ? "লাইভ সেশনটি পাওয়া যায়নি। কোড দিয়ে আবার যোগ দিন।" : "আবার লগইন করুন।");
                    return;
                }
                if (!res.ok) throw new Error("bad status");
                const data = (await res.json()) as LiveState;
                if (!alive) return;
                failures.current = 0;
                setOffline(false);
                setDeadline(Date.now() + data.remainingMs);
                setState(data);
                if (data.status === "FINISHED") return; // stop polling
            } catch {
                failures.current += 1;
                if (failures.current >= 3) setOffline(true);
            }
            if (alive) timer = setTimeout(poll, POLL_MS);
        };
        poll();
        return () => {
            alive = false;
            if (timer) clearTimeout(timer);
        };
    }, [sessionId]);

    const onAnswer = useCallback(
        async (questionId: string, ids: string[]) => {
            setAnswerError(null);
            try {
                const res = await fetch(`/api/student/quiz/live/${sessionId}/answer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ questionId, selectedOptionIds: ids }),
                });
                const body = await res.json().catch(() => ({}));
                if (res.ok || body.error === "already-answered") {
                    setLockedFor(questionId);
                } else if (body.error === "closed" || body.error === "wrong-question") {
                    setLockedFor(questionId); // time is up / moved on; the next poll shows the reveal
                    setAnswerError("সময় শেষ হয়ে গেছে।");
                } else {
                    setAnswerError("উত্তর পাঠানো যায়নি। আবার চেষ্টা করুন।");
                }
            } catch {
                setAnswerError("সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
            }
        },
        [sessionId]
    );

    return (
        <div className="min-h-[80vh] rounded-3xl bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600 p-4 sm:p-6 text-white">
            <div className="mx-auto max-w-2xl">
                <Link href="/student-dashboard/quiz" className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white">
                    <ArrowLeft className="h-3.5 w-3.5" /> বের হন
                </Link>
                {offline && (
                    <p role="status" className="mt-2 rounded-lg bg-black/30 px-3 py-1.5 text-center text-xs">
                        সংযোগ বিচ্ছিন্ন - আবার চেষ্টা করা হচ্ছে...
                    </p>
                )}
                <div className="mt-3">
                    {fatal ? (
                        <div className="py-16 text-center space-y-4">
                            <AlertTriangle className="mx-auto h-10 w-10" strokeWidth={1.5} />
                            <p>{fatal}</p>
                            <Link href="/student-dashboard/quiz" className="inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-700">
                                কুইজ তালিকায় ফিরে যান
                            </Link>
                        </div>
                    ) : !state ? (
                        <div className="text-white [&_p]:text-white/80">
                            <Spinner label="সংযুক্ত হচ্ছে..." />
                        </div>
                    ) : state.status === "LOBBY" ? (
                        <LiveLobby state={state} />
                    ) : state.status === "QUESTION" && state.question ? (
                        <LiveQuestion
                            key={state.question.id}
                            state={state}
                            deadline={deadline}
                            onAnswer={onAnswer}
                            localLocked={lockedFor === state.question.id}
                            error={answerError}
                        />
                    ) : state.status === "REVEAL" ? (
                        <LiveReveal state={state} />
                    ) : state.status === "FINISHED" ? (
                        <div className="space-y-5">
                            <LiveFinished state={state} />
                            <div className="text-center">
                                <Link href="/student-dashboard/quiz" className="inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-700">
                                    কুইজ তালিকায় ফিরে যান
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <Spinner label="অপেক্ষা করুন..." />
                    )}
                </div>
            </div>
        </div>
    );
}
