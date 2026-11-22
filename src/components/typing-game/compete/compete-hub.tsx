"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, Flag, Swords, Trophy, Users, X, Zap } from "lucide-react";
import type { Batchmate, ChallengeOverview, ChallengeSummary } from "@/lib/typing-game/server/challenge-store";

const BASE = "/student-dashboard/typing-game/compete";
const WHITE = { color: "#fff" } as const;

type Data = ChallengeOverview & { batchmates: Batchmate[]; me: string };

const ERRORS: Record<string, string> = {
  ALREADY_OPEN: "এই বন্ধুর সাথে একটা চ্যালেঞ্জ আগেই চলছে।",
  TOO_MANY_OPEN: "একসাথে ১০টার বেশি চ্যালেঞ্জ খোলা রাখা যায় না।",
  NOT_BATCHMATE: "শুধু নিজের ব্যাচের সক্রিয় স্টুডেন্টকে চ্যালেঞ্জ করা যায়।",
  FEATURE_OFF: "আপনার কোর্সে এখন কম্পিটিশন বন্ধ আছে।",
};

function left(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m >= 60) return `${Math.floor(m / 60)} ঘণ্টা ${m % 60} মিনিট`;
  return `${m} মিনিট`;
}

function resultOf(c: ChallengeSummary, me: string): { label: string; tone: string } {
  if (c.status === "declined") return { label: "ফিরিয়ে দিয়েছে", tone: "tap-badge-neutral" };
  if (c.status === "cancelled") return { label: "বাতিল", tone: "tap-badge-neutral" };
  if (c.status === "expired") return { label: c.winnerId === me ? "ওয়াকওভার জয়" : "সময় শেষ", tone: "tap-badge-neutral" };
  if (c.winnerId === null) return { label: "ড্র", tone: "tap-badge-warning" };
  return c.winnerId === me ? { label: "জিতেছেন", tone: "tap-badge-success" } : { label: "হেরেছেন", tone: "tap-badge-danger" };
}

export function CompeteHub() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/typing-game/challenges", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? String(r.status));
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(load, 8000);
    return () => window.clearInterval(t);
  }, [load]);

  async function invite(opponentId: string, mode: "async" | "live") {
    setBusy(`${opponentId}:${mode}`);
    setError("");
    try {
      const r = await fetch("/api/typing-game/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId, mode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? String(r.status));
      router.push(`${BASE}/${d.id}`);
    } catch (e) {
      const code = e instanceof Error ? e.message : "ERROR";
      setError(ERRORS[code] ?? `পাঠানো যায়নি (${code})।`);
      setBusy(null);
    }
  }

  async function respond(id: string, action: "accept" | "decline" | "cancel") {
    setBusy(`${id}:${action}`);
    try {
      const r = await fetch(`/api/typing-game/challenges/${id}/${action}`, { method: "POST" });
      if (r.ok && action === "accept") {
        router.push(`${BASE}/${id}`);
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  const open = useMemo(() => (data?.challenges ?? []).filter((c) => ["pending", "accepted", "running"].includes(c.status)), [data]);
  const done = useMemo(() => (data?.challenges ?? []).filter((c) => !["pending", "accepted", "running"].includes(c.status)), [data]);
  const mates = useMemo(() => {
    const list = data?.batchmates ?? [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((m) => m.name.toLowerCase().includes(s) || m.roll.toLowerCase().includes(s)) : list;
  }, [data, q]);

  if (!data) {
    return error ? (
      <div className="compete-card p-6 text-center">লোড করা যায়নি ({error})।</div>
    ) : (
      <div className="tap-skeleton h-64 rounded-3xl" />
    );
  }

  if (!data.enabled) {
    return (
      <div className="compete-card mx-auto max-w-lg p-8 text-center">
        <Swords className="mx-auto h-10 w-10 text-ink-faint" aria-hidden="true" />
        <p className="mt-3 font-display text-lg font-bold">কম্পিটিশন এখন বন্ধ</p>
        <p className="mt-1 text-sm text-ink-muted">আপনার কোর্সের অ্যাডমিন এটা চালু করলে এখানে ব্যাচমেটদের চ্যালেঞ্জ করতে পারবেন।</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="compete-hero p-5 sm:p-7">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#fde68a" }}>ব্যাচ কম্পিটিশন</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl" style={WHITE}>বন্ধুকে চ্যালেঞ্জ করুন</h1>
            <p className="mt-2 text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.85)" }}>
              একই লেখা দুজনেই টাইপ করবেন। যে কম সময়ে নির্ভুলভাবে শেষ করবে সে জিতবে। জিতলে <b>+20 কয়েন</b>, ড্র হলে <b>+10</b>।
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: "জয়", v: data.record.wins },
              { k: "হার", v: data.record.losses },
              { k: "ড্র", v: data.record.draws },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.14)" }}>
                <p className="font-display text-3xl font-extrabold tabular-nums" style={WHITE}>{s.v}</p>
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>{s.k}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {open.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">চলমান</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {open.map((c) => {
              const waitingForMe = c.incoming && c.status === "pending";
              const live = c.mode === "live";
              return (
                <div key={c.id} className={(waitingForMe ? "compete-invite" : "compete-card") + " flex flex-col gap-3 p-4"}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                        {live ? "লাইভ রেস" : "চ্যালেঞ্জ"} · {c.incoming ? "আপনাকে ডেকেছে" : "আপনি ডেকেছেন"}
                      </p>
                      <p className="mt-0.5 font-display text-lg font-bold">{c.opponentName}</p>
                    </div>
                    <span className="tap-badge tap-badge-neutral inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" /> {left(c.expiresInMs)}
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {waitingForMe
                      ? live
                        ? "এখনই একসাথে রেস করতে চায়। গ্রহণ করলে রেস পেজ খুলবে।"
                        : "সময়মতো খেলুন, ২৪ ঘণ্টার মধ্যে।"
                      : c.status === "pending"
                        ? "প্রতিপক্ষ এখনো গ্রহণ করেনি।"
                        : live
                          ? "দুজনেই রেস পেজে এলে কাউন্টডাউন শুরু হবে।"
                          : c.iPlayed
                            ? `আপনি খেলেছেন (${Math.round(c.myWpm ?? 0)} wpm)। প্রতিপক্ষের অপেক্ষা।`
                            : "আপনার পালা, খেলে ফেলুন।"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {waitingForMe ? (
                      <>
                        <button type="button" disabled={busy !== null} onClick={() => respond(c.id, "accept")} className="tap-btn tap-btn-md compete-btn-race">
                          <Check className="h-4 w-4" aria-hidden="true" /> গ্রহণ করুন
                        </button>
                        <button type="button" disabled={busy !== null} onClick={() => respond(c.id, "decline")} className="tap-btn tap-btn-md tap-btn-ghost">
                          <X className="h-4 w-4" aria-hidden="true" /> না
                        </button>
                      </>
                    ) : (
                      <Link href={`${BASE}/${c.id}`} className={"tap-btn tap-btn-md " + (live ? "compete-btn-race" : "compete-btn-challenge")}>
                        {live ? <Flag className="h-4 w-4" aria-hidden="true" /> : <Zap className="h-4 w-4" aria-hidden="true" />}
                        {live ? "রেস পেজে যান" : c.iPlayed ? "দেখুন" : "খেলুন"}
                      </Link>
                    )}
                    {!c.incoming && !c.iStarted && c.status !== "running" ? (
                      <button type="button" disabled={busy !== null} onClick={() => respond(c.id, "cancel")} className="tap-btn tap-btn-md tap-btn-ghost">
                        বাতিল
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="compete-card flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Users className="h-5 w-5" aria-hidden="true" /> ব্যাচমেট ({data.batchmates.length})
              </h2>
              <p className="text-xs text-ink-muted">
                <b>চ্যালেঞ্জ</b>: যে যার সময়মতো খেলবে · <b>লাইভ রেস</b>: দুজন একসাথে, লাইভ দেখা যাবে
              </p>
            </div>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="নাম বা রোল খুঁজুন"
              aria-label="ব্যাচমেট খুঁজুন"
              className="tap-input w-full rounded-xl border border-[var(--tap-border-strong)] bg-transparent px-3 py-2 text-sm sm:w-56"
            />
          </div>
          {mates.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              {data.batchmates.length === 0 ? "আপনার ব্যাচে এখনো আর কেউ যোগ দেয়নি।" : "কাউকে পাওয়া যায়নি।"}
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {mates.map((m) => (
                <li key={m.userId} className="flex flex-col gap-2 rounded-2xl border border-[var(--tap-border)] p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tap-primary-50)] font-display font-bold text-primary-600">
                      {m.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {m.name} {m.activeToday ? <span className="compete-dot on ml-1 align-middle" title="আজ টাইপ করেছে" /> : null}
                      </p>
                      <p className="text-xs text-ink-muted">
                        রোল {m.roll} · লেভেল {m.level}
                        {m.bestWpm ? ` · সেরা ${m.bestWpm} wpm` : ""}
                        {m.wins ? ` · ${m.wins} জয়` : ""}
                      </p>
                    </div>
                  </div>
                  {m.openId ? (
                    <Link href={`${BASE}/${m.openId}`} className="tap-btn tap-btn-sm tap-btn-secondary">
                      চলমান চ্যালেঞ্জ দেখুন
                    </Link>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" disabled={busy !== null} onClick={() => invite(m.userId, "async")} className="tap-btn tap-btn-sm compete-btn-challenge">
                        <Zap className="h-4 w-4" aria-hidden="true" /> {busy === `${m.userId}:async` ? "পাঠানো হচ্ছে…" : "চ্যালেঞ্জ"}
                      </button>
                      <button type="button" disabled={busy !== null} onClick={() => invite(m.userId, "live")} className="tap-btn tap-btn-sm compete-btn-race">
                        <Flag className="h-4 w-4" aria-hidden="true" /> {busy === `${m.userId}:live` ? "পাঠানো হচ্ছে…" : "লাইভ রেস"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <section className="compete-card p-4">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" /> এই মাসের ব্যাচ সেরা
            </h2>
            {data.standings.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">এই মাসে এখনো কোনো চ্যালেঞ্জ শেষ হয়নি। প্রথম জয়টা আপনার হোক!</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-1.5">
                {data.standings.map((s, i) => (
                  <li key={s.userId} className={"flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm " + (s.userId === data.me ? "bg-[var(--tap-primary-50)] font-bold" : "")}>
                    <span className="w-6 text-center font-display font-bold text-ink-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="tabular-nums">{s.wins} জয়</span>
                    <span className="text-xs text-ink-faint tabular-nums">/{s.played}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="compete-card p-4">
            <h2 className="font-display text-base font-bold">সাম্প্রতিক ফলাফল</h2>
            {done.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">এখনো কোনো ফলাফল নেই।</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1">
                {done.slice(0, 8).map((c) => {
                  const r = resultOf(c, data.me);
                  return (
                    <li key={c.id}>
                      <Link href={`${BASE}/${c.id}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-[var(--tap-surface-hover)]">
                        <span className="min-w-0 flex-1 truncate">vs {c.opponentName}</span>
                        {c.myWpm ? <span className="text-xs text-ink-faint tabular-nums">{Math.round(c.myWpm)} wpm</span> : null}
                        <span className={"tap-badge " + r.tone}>{r.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
