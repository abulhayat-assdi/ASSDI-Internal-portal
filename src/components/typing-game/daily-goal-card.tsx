"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";

const CHOICES = [5, 10, 15, 20, 30, 45, 60];
const DAY = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

interface Props {
  goalMinutes: number;
  todayMs: number;
  week: { day: string; ms: number }[];
}

/** Today's typing minutes against the student's goal, plus the last 7 days. */
export function DailyGoalCard({ goalMinutes, todayMs, week }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const minutes = Math.floor(todayMs / 60000);
  const pct = Math.min(1, todayMs / (goalMinutes * 60000));
  const r = 42;
  const c = 2 * Math.PI * r;
  const done = pct >= 1;

  const choose = async (m: number) => {
    setSaving(true);
    try {
      await fetch("/api/typing-game/daily-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: m }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tap-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="relative h-28 w-28 shrink-0 self-center">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--tap-border)" strokeWidth="9" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={done ? "var(--tap-success-500)" : "var(--tap-primary-500)"}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-extrabold tabular-nums">{minutes}</span>
          <span className="text-[11px] text-ink-muted">/ {goalMinutes} মিনিট</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Target className="h-4 w-4" aria-hidden="true" /> আজকের লক্ষ্য
          </h2>
          <button type="button" className="tap-btn tap-btn-ghost tap-btn-sm" onClick={() => setEditing((e) => !e)}>
            বদলান
          </button>
        </div>
        <p className="text-sm text-ink-muted">
          {done ? "আজকের লক্ষ্য পূরণ হয়েছে! 🎉" : `লক্ষ্য পূরণে আর ${Math.max(0, goalMinutes - minutes)} মিনিট — লেসন, Practice বা Test দিন।`}
        </p>
        {editing ? (
          <div className="flex flex-wrap gap-1">
            {CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                disabled={saving}
                onClick={() => void choose(m)}
                className={`tap-btn tap-btn-sm ${m === goalMinutes ? "tap-btn-primary" : "tap-btn-secondary"}`}
              >
                {m} মিনিট
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-end gap-1.5" aria-label="শেষ ৭ দিন">
            {week.map((d) => {
              const h = Math.max(4, Math.min(40, (d.ms / (goalMinutes * 60000)) * 40));
              const met = d.ms >= goalMinutes * 60000;
              return (
                <div key={d.day} className="flex flex-col items-center gap-1" title={`${d.day}: ${Math.floor(d.ms / 60000)} মিনিট`}>
                  <span className="w-6 rounded" style={{ height: h, background: met ? "var(--tap-success-500)" : "var(--tap-primary-300)" }} />
                  <span className="text-[10px] text-ink-faint">{DAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
