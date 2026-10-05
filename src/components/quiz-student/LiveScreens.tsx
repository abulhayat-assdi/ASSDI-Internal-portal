"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Users, Loader2, Hourglass, PartyPopper } from "lucide-react";
import Leaderboard, { type LeaderboardRow } from "./Leaderboard";
import { Html, optionLabel, useSecondsLeft, type OptionLabelStyle, type StudentQuestion } from "./shared";

export interface LiveState {
  quizTitle: string;
  optionLabelStyle: OptionLabelStyle;
  status: "LOBBY" | "QUESTION" | "REVEAL" | "FINISHED";
  remainingMs: number;
  limitSeconds: number;
  currentIndex: number;
  totalQuestions: number;
  playerCount: number;
  question: StudentQuestion | null;
  myAnswer: { selectedOptionIds: string[]; isCorrect: boolean | null; marksAwarded: number } | null;
  correctOptionIds: string[] | null;
  pickCounts: Record<string, number> | null;
  explanationHtml: string;
  me: { rank: number; score: number } | null;
  leaderboard: LeaderboardRow[];
}

// Four distinct option colours (Kahoot-like) - labels also carry meaning, never colour alone.
const TONES = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-violet-500", "bg-cyan-600"];

export function LiveLobby({ state }: { state: LiveState }) {
  return (
    <div className="text-center space-y-4 py-10">
      <Hourglass className="h-12 w-12 mx-auto motion-safe:animate-pulse" strokeWidth={1.5} />
      <h1 className="text-2xl font-extrabold">{state.quizTitle}</h1>
      <p className="text-white/80">শিক্ষক কুইজ শুরু করার জন্য অপেক্ষা করুন...</p>
      <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
        <Users className="h-4 w-4" /> {state.playerCount} জন যোগ দিয়েছে
      </span>
    </div>
  );
}

/** Countdown bar driven by a local deadline derived from the last poll's remainingMs. */
export function CountdownBar({ deadline, limitSeconds }: { deadline: number; limitSeconds: number }) {
  const left = useSecondsLeft(deadline) ?? 0;
  const pct = Math.min(100, (left / Math.max(1, limitSeconds)) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1 text-sm font-bold tabular-nums">
        <Clock className="h-4 w-4" /> {Math.ceil(left)}
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={Math.ceil(left)} aria-valuemin={0} aria-valuemax={limitSeconds}>
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%`, transition: "width 250ms linear" }} />
      </div>
    </div>
  );
}

export function LiveQuestion({
  state,
  deadline,
  onAnswer,
  localLocked,
  error,
}: {
  state: LiveState;
  deadline: number;
  onAnswer: (questionId: string, ids: string[]) => Promise<void>;
  localLocked: boolean;
  error: string | null;
}) {
  const q = state.question!;
  const multi = q.type === "MULTI_CHOICE";
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const locked = localLocked || state.myAnswer != null;
  const chosen = state.myAnswer?.selectedOptionIds ?? picked;

  const send = async (ids: string[]) => {
    setBusy(true);
    await onAnswer(q.id, ids);
    setBusy(false);
  };
  const tap = (id: string) => {
    if (locked || busy) return;
    if (multi) setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    else {
      setPicked([id]);
      send([id]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-white/80">
        প্রশ্ন {state.currentIndex + 1} / {state.totalQuestions}
      </div>
      <CountdownBar deadline={deadline} limitSeconds={state.limitSeconds} />
      <div className="rounded-2xl bg-white p-4 text-slate-800 shadow-lg">
        <Html html={q.bodyHtml} className="text-base sm:text-lg font-semibold" />
        {multi && <p className="mt-2 text-xs text-violet-600 font-medium">একাধিক উত্তর বাছাই করে জমা দিন।</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((o, i) => {
          const on = chosen.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked || busy}
              aria-pressed={on}
              onClick={() => tap(o.id)}
              className={`cursor-pointer flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left text-white shadow-md transition active:scale-[0.98] disabled:cursor-default ${TONES[i % TONES.length]} ${
                locked && !on ? "opacity-40" : ""
              } ${on ? "ring-4 ring-white" : ""}`}
            >
              <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white/25 text-lg font-extrabold">
                {optionLabel(state.optionLabelStyle, i)}
              </span>
              <Html html={o.textHtml} className="flex-1 text-base font-semibold" />
            </button>
          );
        })}
      </div>
      {multi && !locked && (
        <button
          type="button"
          disabled={picked.length === 0 || busy}
          onClick={() => send(picked)}
          className="cursor-pointer w-full rounded-2xl bg-white py-3.5 text-lg font-extrabold text-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" />} জমা দিন
        </button>
      )}
      {locked && (
        <p className="rounded-xl bg-white/20 px-4 py-3 text-center text-sm font-semibold" aria-live="polite">
          উত্তর জমা হয়েছে - বাকিদের জন্য অপেক্ষা করুন...
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-black/30 px-4 py-2 text-center text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function LiveReveal({ state }: { state: LiveState }) {
  const q = state.question;
  const mine = state.myAnswer;
  const correctIds = state.correctOptionIds ?? [];
  const counts = state.pickCounts ?? {};
  const totalPicks = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));
  return (
    <div className="space-y-4">
      <div
        className="flex items-center justify-center gap-3 rounded-2xl bg-white p-4 text-center text-slate-800 shadow-lg"
        aria-live="polite"
      >
        {!mine ? (
          <span className="font-bold text-slate-500">আপনি উত্তর দেননি</span>
        ) : mine.isCorrect ? (
          <>
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <span className="text-xl font-extrabold text-emerald-600">সঠিক! +{mine.marksAwarded}</span>
          </>
        ) : (
          <>
            <XCircle className="h-8 w-8 text-red-500" />
            <span className="text-xl font-extrabold text-red-600">ভুল{mine.marksAwarded < 0 ? ` ${mine.marksAwarded}` : ""}</span>
          </>
        )}
      </div>

      {q && (
        <div className="rounded-2xl bg-white p-4 text-slate-800 shadow-lg space-y-2">
          <Html html={q.bodyHtml} className="font-semibold" />
          <ul className="space-y-2 pt-1">
            {q.options.map((o, i) => {
              const correct = correctIds.includes(o.id);
              const picked = mine?.selectedOptionIds.includes(o.id);
              const n = counts[o.id] ?? 0;
              return (
                <li
                  key={o.id}
                  className={`relative overflow-hidden rounded-xl border-2 p-2.5 ${
                    correct ? "border-emerald-500 bg-emerald-50" : picked ? "border-red-400 bg-red-50" : "border-slate-200"
                  }`}
                >
                  <div className="absolute inset-y-0 left-0 bg-slate-900/5" style={{ width: `${(n / totalPicks) * 100}%` }} />
                  <div className="relative flex items-center gap-3">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white text-xs font-bold">
                      {optionLabel(state.optionLabelStyle, i)}
                    </span>
                    <Html html={o.textHtml} className="flex-1 text-sm" />
                    {correct && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="সঠিক" />}
                    {picked && !correct && <XCircle className="h-4 w-4 text-red-500" aria-label="আপনার উত্তর" />}
                    <span className="text-xs font-semibold tabular-nums text-slate-500">{n}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {state.explanationHtml && (
            <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
              <Html html={state.explanationHtml} />
            </div>
          )}
        </div>
      )}

      {state.me && (
        <p className="text-center text-sm font-semibold">
          আপনার র‍্যাংক #{state.me.rank} · স্কোর {state.me.score}
        </p>
      )}
      <div className="rounded-2xl bg-white/15 p-4">
        <Leaderboard rows={state.leaderboard} me={state.me ? { ...state.me, name: "", isMe: true } : null} title="টপ ৫" dark />
      </div>
      <p className="text-center text-xs text-white/70">পরের প্রশ্নের জন্য অপেক্ষা করুন...</p>
    </div>
  );
}

export function LiveFinished({ state }: { state: LiveState }) {
  return (
    <div className="space-y-5 text-center">
      <PartyPopper className="mx-auto h-12 w-12" strokeWidth={1.5} />
      <h1 className="text-2xl font-extrabold">কুইজ শেষ!</h1>
      {state.me && (
        <div className="rounded-2xl bg-white p-5 text-slate-800 shadow-lg">
          <p className="text-sm text-slate-500">আপনার র‍্যাংক</p>
          <p className="text-5xl font-extrabold text-brand-600">#{state.me.rank}</p>
          <p className="mt-1 text-sm font-semibold">স্কোর: {state.me.score}</p>
        </div>
      )}
      <div className="rounded-2xl bg-white/15 p-4 text-left">
        <Leaderboard rows={state.leaderboard} me={state.me ? { ...state.me, name: "", isMe: true } : null} title="টপ ৫" dark />
      </div>
    </div>
  );
}
