"use client";

import { useTypingBase } from "@/components/typing-game/use-typing-base";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, CheckCircle2, Hand, Lock, Play, RotateCcw, SkipForward, Star } from "lucide-react";
import { HandPlacementGuide } from "./hand-placement-guide";
import { RewardedAdModal } from "@/components/typing-game/ads/rewarded-ad-modal";

export interface OverviewLesson {
  id: string;
  number: number;
  title: string;
  kind: string;
  /** Timed lessons: length in seconds. */
  seconds: number | null;
  state: "completed" | "skipped" | "available" | "locked";
  stars: number;
  bestWpm: number;
  bestAccuracy: number;
  bestTimeMs: number | null;
  skippable: boolean;
}
export interface OverviewUnit {
  id: string;
  title: string;
  lessons: OverviewLesson[];
}
export interface OverviewLevel {
  id: string | null;
  number: number;
  title: string;
  description: string;
  percent: number;
  ready: boolean;
}

interface Props {
  levels: OverviewLevel[];
  current: OverviewLevel;
  units: OverviewUnit[];
  firstVisit: boolean;
  banglaUnlocked: boolean;
  mode: "en" | "bn";
}


function fmtTime(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LessonsOverview({ levels, current, units, firstVisit, banglaUnlocked, mode }: Props) {
  const BASE = `${useTypingBase()}/lessons`;
  const router = useRouter();
  const [guide, setGuide] = useState(firstVisit);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [adFor, setAdFor] = useState<{ lessonId: string; mode: "unlock" | "skip"; views: number } | null>(null);

  const skip = async (lessonId: string, mode: "unlock" | "skip", confirmed = false) => {
    const ok = confirmed || window.confirm(
      mode === "unlock"
        ? "আগের অসম্পূর্ণ লেসনগুলো skip হিসেবে চিহ্নিত হবে এবং এই লেসনটা খুলে যাবে। স্কিপ করা লেসনে স্টার বা XP পাওয়া যায় না। চালিয়ে যাবেন?"
        : "এই লেসনটা skip করে পরেরটা খুলবেন?",
    );
    if (!ok) return;
    setBusy(lessonId);
    setMsg("");
    try {
      const res = await fetch(`/api/typing-game/lessons/${lessonId}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as { error?: string; views?: number };
      if (res.status === 402 && data.error === "ADS_REQUIRED") {
        // Ads are on: watch the required rewarded ads, then this runs again.
        setAdFor({ lessonId, mode, views: data.views ?? 1 });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? String(res.status));
      if (mode === "unlock") router.push(`${BASE}/${lessonId}`);
      else router.refresh();
    } catch (e) {
      setMsg(`করা যায়নি: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {guide ? <HandPlacementGuide onClose={() => setGuide(false)} /> : null}
      {adFor ? (
        <RewardedAdModal
          action="lesson_skip"
          target={adFor.lessonId}
          views={adFor.views}
          onCancel={() => setAdFor(null)}
          onDone={() => {
            const a = adFor;
            setAdFor(null);
            void skip(a.lessonId, a.mode, true);
          }}
        />
      ) : null}

      <div className="grid gap-6 md:grid-cols-[250px_1fr] xl:grid-cols-[280px_1fr]">
        {/* Levels */}
        <aside className="flex flex-col gap-2">
          <div className="tap-tablist mb-1" role="tablist" aria-label="Mode">
            <Link href={`${BASE}?mode=en`} role="tab" aria-selected={mode === "en"} className={`tap-tab ${mode === "en" ? "tap-tab-active" : ""}`}>
              English
            </Link>
            {banglaUnlocked ? (
              <Link href={`${BASE}?mode=bn`} role="tab" aria-selected={mode === "bn"} className={`tap-tab ${mode === "bn" ? "tap-tab-active" : ""}`}>
                বাংলা
              </Link>
            ) : (
              <span className="tap-tab inline-flex items-center gap-1 opacity-60" title="English Level 1-এর Final Assessment পাস করলে খুলবে">
                বাংলা <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
          </div>
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink-faint">
            {mode === "en" ? "English · Learn to Type" : "বাংলা · Bijoy / Avro"}
          </p>
          {levels.map((l) => {
            const active = l.id === current.id;
            const inner = (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    Level {l.number} · {l.title}
                  </span>
                  {l.ready ? null : <Lock className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />}
                </span>
                <span className="text-xs opacity-80">{l.ready ? `${l.percent}% complete` : "Coming soon"}</span>
              </>
            );
            return l.ready ? (
              <Link
                key={l.number}
                href={`${BASE}?level=${l.id}`}
                aria-current={active ? "page" : undefined}
                className="flex flex-col rounded-xl px-3 py-2.5 text-sm transition-colors"
                style={active ? { background: "var(--tap-primary-grad)", color: "var(--tap-ink-on-accent)" } : { background: "var(--tap-surface)" }}
              >
                {inner}
              </Link>
            ) : (
              <div key={l.number} className="flex flex-col rounded-xl px-3 py-2.5 text-sm opacity-60" style={{ background: "var(--tap-surface)" }}>
                {inner}
              </div>
            );
          })}
          <button type="button" className="tap-btn tap-btn-secondary tap-btn-sm mt-2" onClick={() => setGuide(true)}>
            <Hand className="h-4 w-4" aria-hidden="true" /> হাত কীভাবে বসাবেন
          </button>
        </aside>

        {/* Units + lessons */}
        <section className="flex flex-col gap-4">
          <div className="tap-card flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">
                  Level {current.number} · {current.title}
                </h2>
                <p className="text-sm text-ink-muted">{current.description}</p>
              </div>
              <span className="font-display text-2xl font-extrabold tabular-nums" style={{ color: "var(--tap-primary-600)" }}>
                {current.percent}%
              </span>
            </div>
            <div className="tap-progress-track h-2">
              <div className="tap-progress-fill h-full" style={{ width: `${current.percent}%` }} />
            </div>
          </div>
          {msg ? <p className="text-sm text-red-500">{msg}</p> : null}

          {units.map((u) => (
            <div key={u.id} className="flex flex-col gap-2">
              <h3 className="px-1 font-display text-base font-bold">{u.title}</h3>
              <div className="grid gap-2 xl:grid-cols-2">
              {u.lessons.map((l) => {
                const open = l.state !== "locked";
                return (
                  <div key={l.id} className={`tap-card flex flex-wrap items-center gap-3 p-3 sm:p-4 ${open ? "" : "opacity-75"}`}>
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold"
                      style={{ borderColor: l.state === "completed" ? "var(--tap-success-500)" : "var(--tap-border-strong)" }}
                    >
                      {l.state === "completed" ? <CheckCircle2 className="h-5 w-5" style={{ color: "var(--tap-success-500)" }} aria-hidden="true" /> : l.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-semibold">
                        {l.title}
                        {l.seconds ? <span className="tap-badge tap-badge-warning">{fmtTime(l.seconds * 1000)}</span> : null}
                        {!l.skippable ? <span className="tap-badge tap-badge-primary">Pass required</span> : null}
                        {l.state === "skipped" ? <span className="tap-badge tap-badge-neutral">Skipped</span> : null}
                      </p>
                      {l.state === "completed" ? (
                        <p className="flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
                          <span className="inline-flex">
                            {[1, 2, 3].map((i) => (
                              <Star key={i} className="h-3.5 w-3.5" fill={i <= l.stars ? "#f59e0b" : "none"} stroke={i <= l.stars ? "#f59e0b" : "currentColor"} />
                            ))}
                          </span>
                          <span>Speed {Math.round(l.bestWpm)} wpm</span>
                          <span>Acc {Math.round(l.bestAccuracy)}%</span>
                          <span>Time {fmtTime(l.bestTimeMs)}</span>
                        </p>
                      ) : null}
                    </div>
                    {open ? (
                      <div className="flex gap-2">
                        {l.state === "available" && l.skippable ? (
                          <button type="button" className="tap-btn tap-btn-ghost tap-btn-sm" disabled={busy === l.id} onClick={() => void skip(l.id, "skip")}>
                            <SkipForward className="h-4 w-4" aria-hidden="true" /> Skip
                          </button>
                        ) : null}
                        <Link href={`${BASE}/${l.id}`} className={`tap-btn tap-btn-sm ${l.state === "available" ? "tap-btn-primary" : "tap-btn-secondary"}`}>
                          {l.state === "completed" ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : l.state === "skipped" ? <BookOpen className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                          {l.state === "completed" ? "Redo" : "Start"}
                        </Link>
                      </div>
                    ) : (
                      <button type="button" className="tap-btn tap-btn-ghost tap-btn-sm" disabled={busy === l.id} onClick={() => void skip(l.id, "unlock")}>
                        <Lock className="h-4 w-4" aria-hidden="true" /> Unlock
                      </button>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
