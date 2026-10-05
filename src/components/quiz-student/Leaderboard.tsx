"use client";

import { Trophy } from "lucide-react";

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
  percentage?: number;
}

const MEDAL = ["text-amber-500", "text-slate-400", "text-orange-500"];

/** Compact ranked list used by the live screens and the self-paced result page. */
export default function Leaderboard({
  rows,
  me,
  title = "লিডারবোর্ড",
  dark = false,
}: {
  rows: LeaderboardRow[];
  me?: LeaderboardRow | null;
  title?: string;
  dark?: boolean;
}) {
  const showMeSeparately = me && !rows.some((r) => r.isMe);
  const rowCls = (isMe: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
      isMe
        ? dark ? "bg-white/25 font-bold" : "bg-brand-50 text-brand-700 font-bold ring-1 ring-brand-200"
        : dark ? "bg-white/10" : "bg-slate-50"
    }`;
  const renderRow = (r: LeaderboardRow) => (
    <li key={`${r.rank}-${r.name}`} className={rowCls(r.isMe)}>
      <span className={`w-7 text-center font-bold tabular-nums ${r.rank <= 3 && !dark ? MEDAL[r.rank - 1] : ""}`}>
        {r.rank <= 3 ? <Trophy className="h-4 w-4 inline" strokeWidth={2.25} aria-label={`#${r.rank}`} /> : `#${r.rank}`}
      </span>
      <span className="flex-1 truncate">
        {r.name}
        {r.isMe ? " (আপনি)" : ""}
      </span>
      <span className="tabular-nums font-semibold">{r.score}</span>
    </li>
  );
  return (
    <div>
      <h3 className={`text-sm font-bold mb-2 ${dark ? "text-white/90" : "text-slate-700"}`}>{title}</h3>
      {rows.length === 0 ? (
        <p className={`text-sm ${dark ? "text-white/70" : "text-slate-400"}`}>এখনো কোনো তথ্য নেই।</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map(renderRow)}
          {showMeSeparately && (
            <>
              <li className={`text-center text-xs ${dark ? "text-white/60" : "text-slate-400"}`}>···</li>
              {renderRow(me)}
            </>
          )}
        </ol>
      )}
    </div>
  );
}
