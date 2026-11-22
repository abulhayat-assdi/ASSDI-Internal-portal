"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Flag, RotateCcw, Timer, Trophy, X, Zap } from "lucide-react";
import type { ChallengePlayer, ChallengeState } from "@/lib/typing-game/server/challenge-store";

const BASE = "/student-dashboard/typing-game/compete";
const API = "/api/typing-game/challenges";

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function post(url: string, body?: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? String(r.status));
  return d;
}

function Track({ p, total, color, car, label }: { p: number; total: number; color: string; car: string; label: string }) {
  const pct = total ? Math.min(100, (100 * p) / total) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-sm font-semibold sm:w-32">{label}</span>
      <div className="compete-track flex-1" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span className="compete-track-fill" style={{ width: `${pct}%`, background: color, opacity: 0.35 }} />
        <span className="compete-track-car" style={{ left: `max(2rem, ${pct}%)` }} aria-hidden="true">
          {car}
        </span>
      </div>
      <span className="w-11 shrink-0 text-right text-sm font-bold tabular-nums">{Math.round(pct)}%</span>
    </div>
  );
}

export function ChallengePlay({ id }: { id: string }) {
  const router = useRouter();
  const [st, setSt] = useState<ChallengeState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Typing state
  const [pos, setPos] = useState(0);
  const [errors, setErrors] = useState(0);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const goAt = useRef<number | null>(null); // local ms when my run started
  const sent = useRef({ pos: -1, at: 0 });
  const finishing = useRef(false);
  const posRef = useRef(0);
  const errRef = useRef(0);

  const me = st?.players.find((p) => p.userId === st.me) ?? null;
  const them = st?.players.find((p) => p.userId !== st.me) ?? null;
  const live = st?.mode === "live";
  const myDone = !!me?.finished;
  const over = st ? ["finished", "expired", "declined", "cancelled"].includes(st.status) : false;

  const load = useCallback(
    async (presence: boolean) => {
      try {
        const r = await fetch(`${API}/${id}${presence ? "?presence=1" : ""}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? String(r.status));
        setSt(d as ChallengeState);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ERROR");
      }
    },
    [id],
  );

  // First read, then poll while something can change.
  useEffect(() => {
    void load(false);
  }, [load]);
  const pollMs = !st || over ? 0 : live && !myDone ? 1000 : myDone || st.status === "pending" ? 3000 : 0;
  const presence = !!st && live && st.status === "accepted";
  useEffect(() => {
    if (!pollMs) return;
    const t = window.setInterval(() => void load(presence), pollMs);
    return () => window.clearInterval(t);
  }, [pollMs, presence, load]);

  // Server-timed start: live = shared countdown, async = my own start (survives a reload).
  useEffect(() => {
    if (!st || myDone || goAt.current !== null) return;
    if (live && st.status === "running" && st.startsInMs !== null) goAt.current = Date.now() + st.startsInMs;
    if (!live && st.myElapsedMs !== null && st.text) goAt.current = Date.now() - st.myElapsedMs;
  }, [st, live, myDone]);

  const running = !!st?.text && goAt.current !== null && now >= goAt.current && !myDone && !finishing.current;
  const elapsed = goAt.current !== null ? Math.max(0, now - goAt.current) : 0;
  const countdown = goAt.current !== null && now < goAt.current ? Math.ceil((goAt.current - now) / 1000) : 0;

  useEffect(() => {
    if (goAt.current === null || myDone) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [st, myDone]);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const d = await post(`${API}/${id}/finish`, { progress: posRef.current, errors: errRef.current });
      setSt(d as ChallengeState);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
      finishing.current = false;
    }
  }, [id]);

  // Time limit.
  useEffect(() => {
    if (running && st && elapsed >= st.timeLimitS * 1000) void finish();
  }, [running, elapsed, st, finish]);

  // Live: tell the server how far I am.
  useEffect(() => {
    if (!running || !live) return;
    const t = window.setInterval(() => {
      if (posRef.current === sent.current.pos) return;
      sent.current = { pos: posRef.current, at: Date.now() };
      void post(`${API}/${id}/progress`, { progress: posRef.current, errors: errRef.current }).catch(() => undefined);
    }, 700);
    return () => window.clearInterval(t);
  }, [running, live, id]);

  // Keys.
  useEffect(() => {
    if (!running || !st?.text) return;
    const text = st.text;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      e.preventDefault();
      if (e.key === text[posRef.current]) {
        posRef.current += 1;
        setPos(posRef.current);
        setFlash(false);
        if (posRef.current >= text.length) void finish();
      } else {
        errRef.current += 1;
        setErrors(errRef.current);
        setFlash(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, st?.text, finish]);

  async function act(action: "accept" | "decline" | "cancel" | "begin") {
    setBusy(true);
    setError("");
    try {
      if (action === "begin") {
        const d = (await post(`${API}/${id}/begin`)) as ChallengeState;
        setSt(d);
      } else {
        await post(`${API}/${id}/${action}`);
        if (action === "accept") await load(true);
        else router.push(BASE);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }

  async function rematch() {
    if (!st || !them) return;
    setBusy(true);
    try {
      const d = await post(API, { opponentId: them.userId, mode: st.mode });
      router.push(`${BASE}/${(d as { id: string }).id}`);
    } catch (e) {
      const code = e instanceof Error ? e.message : "ERROR";
      setError(code === "ALREADY_OPEN" ? "এই বন্ধুর সাথে আরেকটা চ্যালেঞ্জ আগেই চলছে।" : code);
      setBusy(false);
    }
  }

  if (!st) {
    return error ? (
      <div className="compete-card mx-auto max-w-md p-6 text-center">
        <p className="font-semibold">চ্যালেঞ্জটা পাওয়া যায়নি ({error})।</p>
        <Link href={BASE} className="tap-btn tap-btn-secondary tap-btn-sm mt-3">ফিরে যান</Link>
      </div>
    ) : (
      <div className="tap-skeleton mx-auto h-64 max-w-3xl rounded-3xl" />
    );
  }

  const opponentName = them?.name ?? "প্রতিপক্ষ";
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link href={BASE} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Compete
      </Link>
      <span className={"tap-badge " + (live ? "tap-badge-danger" : "tap-badge-primary")}>
        {live ? "লাইভ রেস" : "চ্যালেঞ্জ"} · vs {opponentName}
      </span>
    </div>
  );

  // ---- Finished (me) → result
  if (myDone || over) {
    const finalised = st.status === "finished" || st.status === "expired";
    const won = st.winnerId === st.me;
    const draw = st.status === "finished" && st.winnerId === null;
    const title =
      st.status === "declined"
        ? `${opponentName} চ্যালেঞ্জটা নেয়নি`
        : st.status === "cancelled"
          ? "চ্যালেঞ্জ বাতিল হয়েছে"
          : !finalised
            ? "আপনার খেলা শেষ!"
            : st.status === "expired"
              ? won
                ? "প্রতিপক্ষ খেলেনি, ওয়াকওভার জয়"
                : "সময় শেষ, চ্যালেঞ্জ হয়নি"
              : draw
                ? "ড্র!"
                : won
                  ? "আপনি জিতেছেন! 🏆"
                  : `${opponentName} জিতেছে`;
    const row = (p: ChallengePlayer | null, label: string) => (
      <tr>
        <th scope="row" className="text-left">{label}</th>
        <td className="tabular-nums">{p?.wpm != null ? Math.round(p.wpm) : "—"}</td>
        <td className="tabular-nums">{p?.accuracy != null ? `${Math.round(p.accuracy)}%` : "—"}</td>
        <td className="tabular-nums">{p?.timeMs != null ? fmt(p.timeMs) : "—"}</td>
        <td>{p?.completed ? "শেষ করেছে" : p?.finished ? `${Math.round((100 * (p.progress ?? 0)) / st.textLength)}%` : "খেলেনি"}</td>
      </tr>
    );
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {header}
        <section className={(finalised && won && !draw ? "compete-hero" : "compete-card") + " p-6 text-center"}>
          <div className="relative z-10 flex flex-col items-center gap-3">
            {finalised && won ? <Trophy className="h-12 w-12 text-amber-300" aria-hidden="true" /> : null}
            <h1 className="font-display text-3xl font-extrabold" style={finalised && won && !draw ? { color: "#fff" } : undefined}>
              {title}
            </h1>
            {!finalised && myDone ? (
              <p className="text-sm text-ink-muted">
                {live ? "প্রতিপক্ষ এখনো টাইপ করছে…" : `${opponentName} খেললেই ফলাফল আসবে। তখন এখানেই দেখতে পাবেন।`}
              </p>
            ) : null}
            {me && (me.xp > 0 || me.coins > 0) ? (
              <div className="flex gap-2">
                {me.coins > 0 ? <span className="tap-badge tap-badge-legendary">+{me.coins} কয়েন</span> : null}
                {me.xp > 0 ? <span className="tap-badge tap-badge-primary">+{me.xp} XP</span> : null}
              </div>
            ) : null}
          </div>
        </section>
        {me?.finished || them?.finished ? (
          <section className="compete-card overflow-x-auto p-4">
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">খেলোয়াড়</th>
                  <th>WPM</th>
                  <th>নির্ভুলতা</th>
                  <th>সময়</th>
                  <th>অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {row(me, `আপনি`)}
                {row(them, opponentName)}
              </tbody>
            </table>
          </section>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          {finalised || st.status === "declined" || st.status === "cancelled" ? (
            <button type="button" disabled={busy} onClick={rematch} className={"tap-btn tap-btn-md " + (live ? "compete-btn-race" : "compete-btn-challenge")}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> আবার চ্যালেঞ্জ
            </button>
          ) : null}
          <Link href={BASE} className="tap-btn tap-btn-md tap-btn-secondary">
            সব কম্পিটিশন
          </Link>
        </div>
        {error ? <p role="alert" className="text-center text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  const incomingPending = st.status === "pending" && st.opponentId === st.me;

  // ---- Invitation / lobby / intro
  if (!st.text || (goAt.current !== null && countdown > 0) || goAt.current === null) {
    let body: ReactNode;
    if (incomingPending) {
      body = (
        <>
          <p className="text-lg">
            <b>{opponentName}</b> আপনাকে {live ? "লাইভ রেসে" : "টাইপিং চ্যালেঞ্জে"} ডেকেছে।
          </p>
          <div className="flex justify-center gap-2">
            {live ? (
              <button type="button" disabled={busy} onClick={() => act("accept")} className="tap-btn tap-btn-lg compete-btn-race">
                <Check className="h-5 w-5" aria-hidden="true" /> গ্রহণ করুন
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => act("begin")} className="tap-btn tap-btn-lg compete-btn-challenge">
                <Zap className="h-5 w-5" aria-hidden="true" /> গ্রহণ করে খেলুন
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => act("decline")} className="tap-btn tap-btn-lg tap-btn-ghost">
              <X className="h-5 w-5" aria-hidden="true" /> না
            </button>
          </div>
        </>
      );
    } else if (live && st.status === "pending") {
      body = (
        <>
          <p className="text-lg">{opponentName}-কে লাইভ রেসের আমন্ত্রণ পাঠানো হয়েছে।</p>
          <p className="text-sm text-ink-muted">গ্রহণ করলেই এখানে কাউন্টডাউন শুরু হবে। এই পেজটা খোলা রাখুন।</p>
          <div className="flex justify-center"><span className="tap-skeleton h-2 w-40 rounded-full" /></div>
          <button type="button" disabled={busy} onClick={() => act("cancel")} className="tap-btn tap-btn-sm tap-btn-ghost mx-auto">বাতিল করুন</button>
        </>
      );
    } else if (live && st.status === "accepted") {
      body = (
        <>
          <p className="text-lg font-semibold">রেসের লবি</p>
          <div className="flex justify-center gap-6 text-sm">
            {st.players.map((p) => (
              <span key={p.userId} className="flex items-center gap-2">
                <span className={"compete-dot " + (p.present || p.userId === st.me ? "on" : "")} />
                {p.userId === st.me ? "আপনি" : p.name}
              </span>
            ))}
          </div>
          <p className="text-sm text-ink-muted">দুজনেই এই পেজে এলে ৫ সেকেন্ডের কাউন্টডাউন শুরু হবে।</p>
        </>
      );
    } else if (countdown > 0) {
      body = (
        <>
          <p className="text-sm font-semibold uppercase tracking-widest text-ink-muted">তৈরি হোন</p>
          <p className="compete-countdown" key={countdown} aria-live="assertive">{countdown}</p>
          <p className="text-sm text-ink-muted">আঙুল হোম রো-তে রাখুন। ভুল অক্ষর ঠিকটা না দেওয়া পর্যন্ত এগোবে না।</p>
        </>
      );
    } else if (!live && !st.text) {
      body = (
        <>
          <p className="text-lg">
            {st.createdBy === st.me ? `${opponentName}-কে চ্যালেঞ্জ পাঠানো হয়েছে। আপনার অংশটা খেলে ফেলুন।` : `${opponentName}-এর চ্যালেঞ্জ`}
          </p>
          <ul className="mx-auto max-w-md list-disc pl-5 text-left text-sm text-ink-muted">
            <li>প্রায় {Math.round(st.textLength / 5)} শব্দের একটা লেখা, সময় সর্বোচ্চ {Math.round(st.timeLimitS / 60)} মিনিট।</li>
            <li>“শুরু করুন” চাপলেই ঘড়ি চালু হবে। পেজ রিলোড করলেও ঘড়ি থামবে না।</li>
            <li>ভুল অক্ষর দিলে এগোবে না, আর নির্ভুলতা কমবে।</li>
          </ul>
          <button type="button" disabled={busy} onClick={() => act("begin")} className="tap-btn tap-btn-lg compete-btn-challenge mx-auto">
            <Timer className="h-5 w-5" aria-hidden="true" /> শুরু করুন
          </button>
        </>
      );
    } else {
      body = <div className="tap-skeleton mx-auto h-10 w-40 rounded-xl" />;
    }
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {header}
        <section className="compete-card flex flex-col gap-4 p-6 text-center sm:p-10">{body}</section>
        {error ? <p role="alert" className="text-center text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  // ---- Racing
  const text = st.text;
  const remaining = st.timeLimitS * 1000 - elapsed;
  const wpm = elapsed > 2000 ? Math.round(pos / 5 / (elapsed / 60000)) : 0;
  const theirPos = them?.progress ?? 0;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      {header}
      <section className="compete-card flex flex-col gap-3 p-4 sm:p-5">
        <Track p={pos} total={text.length} color="#6366f1" car="🏎️" label="আপনি" />
        {live ? <Track p={theirPos} total={text.length} color="#f43f5e" car="🚙" label={opponentName} /> : null}
      </section>
      <section className="compete-card p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1 font-bold tabular-nums">
            <Timer className="h-4 w-4" aria-hidden="true" /> {fmt(remaining)}
          </span>
          <span className="tabular-nums"><b>{wpm}</b> wpm</span>
          <span className="tabular-nums">ভুল: <b>{errors}</b></span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-faint">
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> কিবোর্ডে টাইপ শুরু করুন
          </span>
        </div>
        <p className="compete-text" aria-label="টাইপ করার লেখা">
          <span className="done">{text.slice(0, pos)}</span>
          <span className={"cur" + (flash ? " err" : "")}>{text[pos] === " " ? " " : text[pos]}</span>
          <span className="todo">{text.slice(pos + 1)}</span>
        </p>
      </section>
      {error ? <p role="alert" className="text-center text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
