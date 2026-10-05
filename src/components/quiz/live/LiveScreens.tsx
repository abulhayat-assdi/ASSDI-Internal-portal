"use client";

import { Users, Play, Eye, SkipForward, Trophy, Check, Clock } from "lucide-react";
import { optionLabel } from "../types";
import { RichHtml } from "../ui";
import type { LiveRank, LiveState } from "./liveTypes";

const OPTION_COLORS = ["bg-red-500", "bg-blue-500", "bg-amber-500", "bg-emerald-600", "bg-fuchsia-500", "bg-cyan-600", "bg-orange-500", "bg-indigo-500"];
const bigBtn = "cursor-pointer inline-flex items-center justify-center gap-2 text-lg sm:text-xl font-bold px-8 py-4 rounded-2xl shadow-xl transition-transform active:scale-95 motion-reduce:transition-none disabled:opacity-50";

export function Lobby({ state, busy, onStart }: { state: LiveState; busy: boolean; onStart: () => void }) {
    return (
        <div className="min-h-screen flex flex-col items-center px-4 py-14 text-center">
            <p className="text-lg text-indigo-200">{state.quizTitle}</p>
            <p className="mt-6 text-base sm:text-xl text-slate-300">স্টুডেন্ট পোর্টালের Quiz পেজে গিয়ে &quot;Join live&quot; এ এই কোডটি দিন</p>
            <div className="mt-4 rounded-3xl bg-white text-slate-900 px-8 sm:px-14 py-6 shadow-2xl">
                <span className="font-black tracking-[0.2em] tabular-nums text-6xl sm:text-8xl md:text-9xl">{state.joinCode}</span>
            </div>
            <div className="mt-10 flex items-center gap-2 text-xl text-slate-200"><Users className="h-6 w-6" /> {state.playerCount} জন জয়েন করেছে</div>
            <div className="mt-4 max-w-4xl flex flex-wrap justify-center gap-2">
                {state.players.map((p, i) => (
                    <span key={`${p.roll}-${i}`} className="px-4 py-1.5 rounded-full bg-white/10 text-base sm:text-lg">{p.name}</span>
                ))}
                {state.players.length === 0 && <span className="text-slate-400">কেউ এখনো জয়েন করেনি...</span>}
            </div>
            <button onClick={onStart} disabled={busy || state.playerCount === 0} className={`${bigBtn} mt-12 bg-emerald-500 hover:bg-emerald-400 text-white`}>
                <Play className="h-6 w-6" /> শুরু করুন ({state.totalQuestions} প্রশ্ন)
            </button>
        </div>
    );
}

function Progress({ state }: { state: LiveState }) {
    return <p className="text-slate-300 text-lg">প্রশ্ন {state.currentIndex + 1} / {state.totalQuestions}</p>;
}

function Options({ state, reveal }: { state: LiveState; reveal: boolean }) {
    const q = state.question!;
    const max = Math.max(1, ...Object.values(state.optionCounts));
    return (
        <div className={`mt-8 grid gap-3 sm:gap-4 ${q.options.length > 2 ? "md:grid-cols-2" : "grid-cols-1"}`}>
            {q.options.map((o, i) => {
                const count = state.optionCounts[o.id] ?? 0;
                const dim = reveal && !o.isCorrect;
                return (
                    <div
                        key={o.id}
                        className={`relative overflow-hidden rounded-2xl ${OPTION_COLORS[i % OPTION_COLORS.length]} px-5 py-4 flex items-center gap-4 transition-opacity motion-reduce:transition-none ${dim ? "opacity-35" : ""} ${reveal && o.isCorrect ? "ring-4 ring-white" : ""}`}
                    >
                        <span className="h-10 w-10 shrink-0 rounded-full bg-black/25 flex items-center justify-center text-xl font-black">{optionLabel(state.optionLabelStyle, i)}</span>
                        <RichHtml html={o.textHtml} className="!text-white !text-xl sm:!text-2xl font-semibold prose-invert [&_p]:!m-0 flex-1" />
                        {reveal && o.isCorrect && <Check className="h-8 w-8 shrink-0" strokeWidth={4} />}
                        {reveal && (
                            <div className="absolute inset-x-0 bottom-0 h-2 bg-black/20">
                                <div className="h-full bg-white/80 transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                        )}
                        {reveal && <span className="text-2xl font-black tabular-nums shrink-0">{count}</span>}
                    </div>
                );
            })}
        </div>
    );
}

export function QuestionScreen({ state, remainingMs, busy, onReveal }: { state: LiveState; remainingMs: number; busy: boolean; onReveal: () => void }) {
    const q = state.question;
    if (!q) return null;
    const secs = Math.ceil(remainingMs / 1000);
    const urgent = secs <= 5;
    return (
        <div className="min-h-screen max-w-6xl mx-auto px-4 sm:px-8 py-16">
            <div className="flex items-center justify-between gap-4">
                <Progress state={state} />
                <div className={`flex items-center gap-2 rounded-full px-6 py-2 text-4xl sm:text-5xl font-black tabular-nums ${urgent ? "bg-red-500 animate-pulse motion-reduce:animate-none" : "bg-white/15"}`}>
                    <Clock className="h-8 w-8" /> {secs}
                </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, (remainingMs / (state.limitSeconds * 1000)) * 100)}%` }} />
            </div>
            <RichHtml html={q.bodyHtml} className="mt-8 prose-invert !max-w-none [&_*]:!text-white !text-3xl sm:!text-4xl font-bold leading-snug" />
            <Options state={state} reveal={false} />
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <p className="text-2xl"><b className="text-emerald-300 tabular-nums">{state.answered}</b> / {state.playerCount} উত্তর দিয়েছে</p>
                <button onClick={onReveal} disabled={busy} className={`${bigBtn} bg-white text-slate-900 hover:bg-slate-100`}><Eye className="h-6 w-6" /> এখনই Reveal</button>
            </div>
        </div>
    );
}

function Board({ rows, limit = 10 }: { rows: LiveRank[]; limit?: number }) {
    return (
        <ol className="space-y-2">
            {rows.slice(0, limit).map((r) => (
                <li key={`${r.rank}-${r.roll}`} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5 text-lg">
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-sm ${r.rank === 1 ? "bg-amber-400 text-slate-900" : r.rank === 2 ? "bg-slate-300 text-slate-900" : r.rank === 3 ? "bg-orange-400 text-slate-900" : "bg-white/15"}`}>{r.rank}</span>
                    <span className="flex-1 truncate font-semibold">{r.name}</span>
                    <span className="tabular-nums font-black text-emerald-300">{r.score}</span>
                </li>
            ))}
            {rows.length === 0 && <li className="text-slate-400">কোনো খেলোয়াড় নেই।</li>}
        </ol>
    );
}

export function RevealScreen({ state, busy, onNext }: { state: LiveState; busy: boolean; onNext: () => void }) {
    const q = state.question;
    if (!q) return null;
    const last = state.currentIndex + 1 >= state.totalQuestions;
    return (
        <div className="min-h-screen max-w-6xl mx-auto px-4 sm:px-8 py-16">
            <Progress state={state} />
            <RichHtml html={q.bodyHtml} className="mt-4 prose-invert !max-w-none [&_*]:!text-white !text-2xl sm:!text-3xl font-bold leading-snug" />
            <Options state={state} reveal />
            {q.explanationHtml && <RichHtml html={q.explanationHtml} className="mt-5 rounded-xl bg-white/10 p-4 prose-invert !max-w-none [&_*]:!text-slate-100" />}
            <h2 className="no-gradient mt-10 mb-3 text-2xl font-bold flex items-center gap-2 !text-white"><Trophy className="h-6 w-6 text-amber-400" /> লিডারবোর্ড (Top 10)</h2>
            <Board rows={state.leaderboard} />
            <div className="mt-8 flex justify-end">
                <button onClick={onNext} disabled={busy} className={`${bigBtn} bg-emerald-500 hover:bg-emerald-400 text-white`}>
                    <SkipForward className="h-6 w-6" /> {last ? "ফলাফল দেখান" : "পরের প্রশ্ন"}
                </button>
            </div>
        </div>
    );
}

export function FinishedScreen({ state, onBack }: { state: LiveState; onBack: () => void }) {
    const podium = state.leaderboard.slice(0, 3);
    const order = [podium[1], podium[0], podium[2]];
    const heights = ["h-32", "h-44", "h-24"];
    return (
        <div className="min-h-screen max-w-3xl mx-auto px-4 py-16 text-center">
            <Trophy className="h-14 w-14 text-amber-400 mx-auto" />
            <h1 className="no-gradient mt-3 text-4xl sm:text-5xl font-black !text-white">{state.quizTitle}</h1>
            <p className="text-slate-300 mt-1 text-lg">লাইভ কুইজ শেষ — ফাইনাল ফলাফল</p>
            {podium.length > 0 && (
                <div className="mt-10 flex items-end justify-center gap-3">
                    {order.map((p, i) =>
                        p ? (
                            <div key={`p-${i}`} className="w-28 sm:w-40">
                                <p className="font-bold text-lg truncate">{p.name}</p>
                                <p className="text-emerald-300 font-black tabular-nums">{p.score}</p>
                                <div className={`${heights[i]} mt-2 rounded-t-2xl flex items-start justify-center pt-3 text-4xl font-black text-slate-900 ${p.rank === 1 ? "bg-amber-400" : p.rank === 2 ? "bg-slate-300" : "bg-orange-400"}`}>{p.rank}</div>
                            </div>
                        ) : <div key={`gap-${i}`} className="w-28 sm:w-40" />
                    )}
                </div>
            )}
            <div className="mt-10 text-left"><Board rows={state.leaderboard} /></div>
            <button onClick={onBack} className={`${bigBtn} mt-10 bg-white text-slate-900 hover:bg-slate-100`}>কুইজ লিস্টে ফিরুন</button>
        </div>
    );
}
