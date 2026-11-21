"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Hand, Keyboard, RotateCcw, Star, Volume2, VolumeX } from "lucide-react";
import type { LessonScreen } from "@/lib/typing-game/curriculum/types";
import { fingerFor, keyDisplayName, keyFor, type FingerId } from "@/lib/typing-game/curriculum/keyboard";
import { starsFor } from "@/lib/typing-game/curriculum/progress";
import { OnScreenKeyboard } from "./on-screen-keyboard";
import { Hands } from "./hands";
import { AdSlot } from "@/components/typing-game/ads/ad-slot";

interface Props {
  lessonId: string;
  lessonTitle: string;
  levelTitle: string;
  screens: LessonScreen[];
}

interface ScreenStats {
  correct: number;
  errors: number;
  elapsedMs: number;
}

interface LessonOutcome {
  result: { wpm: number; accuracy: number; stars: number; elapsedMs: number };
  xp: number;
  nextLessonId: string | null;
  banglaUnlocked: boolean;
}

type Phase = "typing" | "screen_done" | "submitting" | "done" | "error";

const LESSONS_HREF = "/student-dashboard/typing-game/lessons";
const PREFS_KEY = "tap.lesson.prefs.v1";

function loadPrefs(): { keyboard: boolean; hands: boolean; voice: boolean } {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) return { keyboard: true, hands: true, voice: false, ...(JSON.parse(raw) as object) };
  } catch {
    /* storage unavailable */
  }
  return { keyboard: true, hands: true, voice: false };
}

function wpmOf(chars: number, ms: number): number {
  return Math.round(chars / 5 / (Math.max(ms, 1000) / 60000));
}
function accuracyOf(s: ScreenStats): number {
  const total = s.correct + s.errors;
  return total === 0 ? 100 : Math.round((s.correct / total) * 1000) / 10;
}
function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Stars({ n, size = "h-6 w-6" }: { n: number; size?: string }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} className={size} fill={i <= n ? "#f59e0b" : "none"} stroke={i <= n ? "#f59e0b" : "var(--tap-border-strong)"} />
      ))}
    </span>
  );
}

export function LessonPlayer({ lessonId, lessonTitle, levelTitle, screens }: Props) {
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(0);
  const [found, setFound] = useState(false);
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("typing");
  const [stats, setStats] = useState<ScreenStats[]>(() => screens.map(() => ({ correct: 0, errors: 0, elapsedMs: 0 })));
  const [now, setNow] = useState(0);
  const [prefs, setPrefs] = useState({ keyboard: true, hands: true, voice: false });
  const [outcome, setOutcome] = useState<LessonOutcome | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const startRef = useRef<number | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const screen = screens[index];
  const chars = useMemo(() => Array.from(screen.text), [screen.text]);
  const expected = screen.type === "key_intro" ? (found ? "" : chars[0]) : chars[pos] ?? "";
  const current = stats[index];

  useEffect(() => setPrefs(loadPrefs()), []);
  const setPref = (k: keyof typeof prefs) =>
    setPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  // Read the instruction aloud (English voice only; Bangla has no reliable browser voice).
  useEffect(() => {
    if (!prefs.voice || phase !== "typing" || screen.type !== "key_intro" || typeof speechSynthesis === "undefined") return;
    const finger = fingerFor(screen.text);
    const u = new SpeechSynthesisUtterance(
      screen.text === " " ? "Press the space bar with your thumb" : `Use your ${finger?.en ?? "finger"}. Type the ${keyDisplayName(screen.text)} key.`,
    );
    u.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }, [index, phase, prefs.voice, screen]);

  const finishScreen = useCallback(
    (at: number) => {
      const start = startRef.current ?? at;
      const limit = screen.type === "timed" ? (screen.seconds ?? 60) * 1000 : Infinity;
      setStats((all) => all.map((s, i) => (i === index ? { ...s, elapsedMs: Math.min(at - start, limit) } : s)));
      setPhase("screen_done");
    },
    [index, screen],
  );

  // Timed screen clock.
  useEffect(() => {
    if (phase !== "typing" || screen.type !== "timed") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (startRef.current !== null && t - startRef.current >= (screen.seconds ?? 60) * 1000) {
        finishScreen(startRef.current + (screen.seconds ?? 60) * 1000);
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, screen, finishScreen]);

  const submitLesson = useCallback(async () => {
    setPhase("submitting");
    const total = stats.reduce(
      (a, s) => ({ correct: a.correct + s.correct, errors: a.errors + s.errors, elapsedMs: a.elapsedMs + s.elapsedMs }),
      { correct: 0, errors: 0, elapsedMs: 0 },
    );
    try {
      const res = await fetch(`/api/typing-game/lessons/${lessonId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correctChars: total.correct,
          keystrokes: total.correct + total.errors,
          errors: total.errors,
          elapsedMs: Math.round(total.elapsedMs),
        }),
      });
      const data = (await res.json()) as LessonOutcome & { error?: string };
      if (!res.ok) throw new Error(data.error ?? String(res.status));
      setOutcome(data);
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "ERROR");
      setPhase("error");
    }
  }, [lessonId, stats]);

  const nextScreen = useCallback(() => {
    if (index + 1 < screens.length) {
      setIndex(index + 1);
      setPos(0);
      setFound(false);
      setWrongKey(null);
      startRef.current = null;
      setPhase("typing");
    } else {
      void submitLesson();
    }
  }, [index, screens.length, submitLesson]);

  const redoScreen = useCallback(() => {
    setStats((all) => all.map((s, i) => (i === index ? { correct: 0, errors: 0, elapsedMs: 0 } : s)));
    setPos(0);
    setFound(false);
    setWrongKey(null);
    startRef.current = null;
    setPhase("typing");
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;

      if (phase === "screen_done") {
        if (e.key === "Enter") {
          e.preventDefault();
          nextScreen();
        }
        return;
      }
      if (phase !== "typing") return;

      if (screen.type === "key_intro" && found) {
        // Finding a key needs no score screen: straight on to the drill.
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const t = Date.now();
          const start = startRef.current ?? t;
          setStats((all) => all.map((s, i) => (i === index ? { ...s, elapsedMs: t - start } : s)));
          nextScreen();
        }
        return;
      }
      if (e.key.length !== 1) return;
      e.preventDefault();
      const t = Date.now();
      if (startRef.current === null) startRef.current = t;

      if (e.key === expected) {
        setWrongKey(null);
        setStats((all) => all.map((s, i) => (i === index ? { ...s, correct: s.correct + 1 } : s)));
        if (screen.type === "key_intro") {
          setFound(true);
          return;
        }
        const nextPos = pos + 1;
        setPos(nextPos);
        if (nextPos >= chars.length) finishScreen(t);
      } else {
        setWrongKey(e.key);
        // While searching for a brand-new key, wrong presses are not mistakes.
        if (screen.type !== "key_intro") {
          setStats((all) => all.map((s, i) => (i === index ? { ...s, errors: s.errors + 1 } : s)));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, screen, found, expected, index, pos, chars.length, finishScreen, nextScreen]);

  // Keep the current character in view on long texts.
  useEffect(() => {
    const el = textRef.current?.querySelector<HTMLElement>("[data-current='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [pos, index]);

  const finger = expected ? fingerFor(expected) : null;
  // A shifted character also needs the little finger of the other hand on Shift.
  const activeFingers: FingerId[] = finger
    ? keyFor(expected)?.shifted
      ? [finger.id, finger.hand === "left" ? "r-pinky" : "l-pinky"]
      : [finger.id]
    : [];
  const liveMs = startRef.current ? (now || Date.now()) - startRef.current : 0;
  const timeLeft = screen.type === "timed" ? Math.max(0, (screen.seconds ?? 60) - Math.floor(liveMs / 1000)) : null;

  // ---------- Finished lesson ----------
  if (phase === "done" && outcome) {
    const r = outcome.result;
    return (
      <div className="tap-card mx-auto flex max-w-xl flex-col items-center gap-4 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{levelTitle}</p>
        <h2 className="font-display text-2xl font-extrabold">{lessonTitle} — সম্পূর্ণ!</h2>
        <Stars n={r.stars} size="h-10 w-10" />
        <dl className="grid w-full grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-ink-faint">Speed</dt>
            <dd className="text-2xl font-bold tabular-nums">{Math.round(r.wpm)} <span className="text-xs">wpm</span></dd>
          </div>
          <div>
            <dt className="text-ink-faint">Accuracy</dt>
            <dd className="text-2xl font-bold tabular-nums">{Math.round(r.accuracy)}%</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Time</dt>
            <dd className="text-2xl font-bold tabular-nums">{fmtTime(r.elapsedMs)}</dd>
          </div>
        </dl>
        {outcome.xp > 0 ? <p className="tap-badge tap-badge-legendary">+{outcome.xp} XP</p> : null}
        {outcome.banglaUnlocked ? (
          <p className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: "var(--tap-primary-50)", color: "var(--tap-primary-700)" }}>
            🎉 বাংলা মোড খুলে গেছে! এখন Practice-এ বাংলা টাইপিংও করতে পারবেন।
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          {outcome.nextLessonId ? (
            <Link href={`${LESSONS_HREF}/${outcome.nextLessonId}`} className="tap-btn tap-btn-primary tap-btn-md">
              পরের লেসন <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          <button type="button" className="tap-btn tap-btn-secondary tap-btn-md" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> আবার করুন
          </button>
          <Link href={LESSONS_HREF} className="tap-btn tap-btn-ghost tap-btn-md">
            সব লেসন
          </Link>
        </div>
        <AdSlot slot="result" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header: lesson + screen progress + toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{levelTitle}</p>
          <h1 className="font-display text-xl font-bold">{lessonTitle}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={`tap-btn tap-btn-sm ${prefs.keyboard ? "tap-btn-secondary" : "tap-btn-ghost"}`} onClick={() => setPref("keyboard")} aria-pressed={prefs.keyboard} title="Keyboard">
            <Keyboard className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={`tap-btn tap-btn-sm ${prefs.hands ? "tap-btn-secondary" : "tap-btn-ghost"}`} onClick={() => setPref("hands")} aria-pressed={prefs.hands} title="Hands">
            <Hand className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={`tap-btn tap-btn-sm ${prefs.voice ? "tap-btn-secondary" : "tap-btn-ghost"}`} onClick={() => setPref("voice")} aria-pressed={prefs.voice} title="Read aloud (English)">
            {prefs.voice ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className="flex gap-1" aria-label={`Screen ${index + 1} of ${screens.length}`}>
        {screens.map((_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < index || (i === index && phase === "screen_done") ? "var(--tap-primary-500)" : i === index ? "var(--tap-primary-300)" : "var(--tap-border)" }}
          />
        ))}
      </div>

      {/* Main card */}
      <div className="tap-card flex min-h-[220px] flex-col items-center justify-center gap-4 p-5 sm:p-8">
        {phase === "error" ? (
          <div className="text-center">
            <p className="font-semibold">ফল সেভ করা যায়নি ({errorMsg})।</p>
            <button type="button" className="tap-btn tap-btn-primary tap-btn-sm mt-3" onClick={() => void submitLesson()}>
              আবার চেষ্টা করুন
            </button>
          </div>
        ) : phase === "submitting" ? (
          <div className="tap-spinner" aria-label="Saving" />
        ) : phase === "screen_done" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Stars n={starsFor(accuracyOf(current))} size="h-9 w-9" />
            <p className="text-sm text-ink-muted">
              Speed <b className="tabular-nums">{wpmOf(current.correct, current.elapsedMs)} wpm</b> · Accuracy{" "}
              <b className="tabular-nums">{Math.round(accuracyOf(current))}%</b> · Time <b className="tabular-nums">{fmtTime(current.elapsedMs)}</b>
            </p>
            <div className="flex gap-2">
              <button type="button" className="tap-btn tap-btn-secondary tap-btn-md" onClick={redoScreen}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Redo
              </button>
              <button type="button" className="tap-btn tap-btn-primary tap-btn-md" onClick={nextScreen} autoFocus>
                {index + 1 < screens.length ? "Continue" : "Finish lesson"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-ink-faint">Enter চাপলেও এগোবে</p>
          </div>
        ) : screen.type === "key_intro" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-ink-muted">{screen.title}</p>
            <p className="font-display text-3xl font-bold sm:text-4xl">
              Type the{" "}
              <span
                className="mx-1 inline-flex min-w-[3.5rem] items-center justify-center rounded-xl border-2 px-3 py-1 font-mono"
                style={{ borderColor: found ? "var(--tap-success-500)" : "var(--tap-ink)", background: found ? "var(--tap-success-500)" : "transparent", color: found ? "#fff" : undefined }}
              >
                {keyDisplayName(screen.text)}
              </span>{" "}
              key
            </p>
            {found ? (
              <p className="tap-anim-in text-sm font-semibold" style={{ color: "var(--tap-success-500)" }}>
                পেয়ে গেছেন! জায়গাটা মনে রাখুন — Enter চাপুন
              </p>
            ) : wrongKey ? (
              <p className="text-sm text-red-500">এটা {keyDisplayName(wrongKey)} — কিবোর্ডে হাইলাইট করা কী-টা খুঁজুন</p>
            ) : null}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between text-sm text-ink-muted">
              <span>{screen.title}</span>
              {timeLeft !== null ? (
                <span className="font-display text-2xl font-bold tabular-nums" style={{ color: "var(--tap-primary-600)" }}>
                  {startRef.current ? timeLeft : screen.seconds}s
                </span>
              ) : null}
            </div>
            <div
              ref={textRef}
              className={`max-h-44 overflow-hidden font-mono leading-relaxed ${chars.length <= 60 ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
              aria-live="off"
            >
              {chars.map((c, i) => {
                const done = i < pos;
                const cur = i === pos;
                return (
                  <span
                    key={i}
                    data-current={cur ? "true" : undefined}
                    className={`${done ? "text-ink-faint" : "text-ink"} ${cur ? "rounded-md" : ""}`}
                    style={
                      cur
                        ? {
                            background: wrongKey ? "#fecaca" : "var(--tap-primary-100)",
                            boxShadow: `inset 0 -3px 0 ${wrongKey ? "#ef4444" : "var(--tap-primary-500)"}`,
                          }
                        : undefined
                    }
                  >
                    {c === " " ? " " : c}
                  </span>
                );
              })}
            </div>
            {startRef.current === null ? <p className="text-center text-xs text-ink-faint">টাইপ শুরু করুন — প্রথম কী চাপলেই সময় শুরু</p> : null}
          </div>
        )}
      </div>

      {/* Keyboard + hands */}
      {phase === "typing" && (prefs.keyboard || prefs.hands) ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-1">
          {finger ? (
            <p className="text-sm font-semibold" style={{ color: finger.color }}>
              {keyFor(expected)?.shifted ? `Shift + ` : ""}
              {finger.bn} · {keyDisplayName(expected)}
            </p>
          ) : null}
          {prefs.keyboard ? <OnScreenKeyboard next={expected} wrong={wrongKey} /> : null}
          {prefs.hands ? <Hands fingers={activeFingers} className="w-full max-w-lg" /> : null}
        </div>
      ) : null}
    </div>
  );
}
