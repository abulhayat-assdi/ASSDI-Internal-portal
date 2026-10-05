"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lobby, QuestionScreen, RevealScreen, FinishedScreen } from "./LiveScreens";
import type { LiveState } from "./liveTypes";

/** Full-screen, projector-friendly host view. Polls the live session and POSTs host controls. */
export default function LiveHost({ sessionId }: { sessionId: string }) {
    const router = useRouter();
    const [state, setState] = useState<LiveState | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [remaining, setRemaining] = useState(0);
    const polled = useRef<{ at: number; remainingMs: number }>({ at: 0, remainingMs: 0 });
    const status = state?.status;
    const finished = status === "FINISHED";

    const poll = useCallback(async () => {
        try {
            const res = await fetch(`/api/quiz/live/${sessionId}`, { cache: "no-store" });
            if (!res.ok) {
                setError(res.status === 404 ? "সেশন পাওয়া যায়নি" : `Error ${res.status}`);
                return;
            }
            const data: LiveState = await res.json();
            polled.current = { at: Date.now(), remainingMs: data.remainingMs };
            setRemaining(data.remainingMs);
            setState(data);
            setError("");
        } catch {
            setError("কানেকশন সমস্যা — আবার চেষ্টা করছি...");
        }
    }, [sessionId]);

    useEffect(() => {
        poll();
        if (finished) return;
        // Poll faster while a question is open so the "answered" counter keeps up.
        const t = setInterval(poll, status === "QUESTION" ? 700 : 1500);
        return () => clearInterval(t);
    }, [poll, finished, status]);

    // Tick the countdown locally between polls.
    useEffect(() => {
        const t = setInterval(() => {
            const { at, remainingMs } = polled.current;
            setRemaining(Math.max(0, remainingMs - (Date.now() - at)));
        }, 200);
        return () => clearInterval(t);
    }, []);

    async function act(action: "next" | "reveal" | "end") {
        if (busy) return;
        if (action === "end" && !confirm("লাইভ সেশন শেষ করবেন?")) return;
        setBusy(true);
        const res = await fetch(`/api/quiz/live/${sessionId}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
        });
        if (!res.ok) setError((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
        await poll();
        setBusy(false);
    }

    const back = () => router.push("/dashboard/quiz");

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {error && <span className="text-xs bg-red-500/20 text-red-200 px-3 py-1 rounded-full">{error}</span>}
                {!finished && state && (
                    <button onClick={() => act("end")} className="cursor-pointer text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-red-500/40 transition-colors">শেষ করুন</button>
                )}
                <button onClick={back} className="cursor-pointer text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">বের হন</button>
            </div>

            {!state ? (
                <div className="min-h-screen flex items-center justify-center">
                    {error ? <p className="text-xl text-red-200">{error}</p> : <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent" />}
                </div>
            ) : state.status === "LOBBY" ? (
                <Lobby state={state} busy={busy} onStart={() => act("next")} />
            ) : state.status === "QUESTION" ? (
                <QuestionScreen state={state} remainingMs={remaining} busy={busy} onReveal={() => act("reveal")} />
            ) : state.status === "REVEAL" ? (
                <RevealScreen state={state} busy={busy} onNext={() => act("next")} />
            ) : (
                <FinishedScreen state={state} onBack={back} />
            )}
        </div>
    );
}
