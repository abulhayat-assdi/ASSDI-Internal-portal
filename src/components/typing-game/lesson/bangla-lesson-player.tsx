"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, RotateCcw, Star } from "lucide-react";
import TypingField from "@/components/typing-exam/TypingField";
import { TypingExamEngine } from "@/lib/typing-exam/engine";
import { scoreAttempt } from "@/lib/typing-exam/scoring";
import { caretIndex } from "@/lib/typing-exam/words";
import { graphemes, typingHint, type BanglaLayout } from "@/lib/typing-game/curriculum/bangla";
import { starsFor, type ScreenSnapshot } from "@/lib/typing-game/curriculum/progress";
import type { LessonScreen } from "@/lib/typing-game/curriculum/types";
import { AdSlot } from "@/components/typing-game/ads/ad-slot";

interface Props {
  lessonId: string;
  lessonTitle: string;
  levelTitle: string;
  screens: LessonScreen[];
}

interface Outcome {
  result: { wpm: number; accuracy: number; stars: number; elapsedMs: number };
  xp: number;
  nextLessonId: string | null;
}

type Phase = "typing" | "screen_done" | "submitting" | "done" | "error";

const LESSONS_HREF = "/student-dashboard/typing-game/lessons";
const LAYOUT_KEY = "tap.bangla.layout.v1";
/** Untimed screens still need a ceiling for the engine. */
const UNTIMED_MS = 30 * 60 * 1000;

function fmt(ms: number): string {
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

/**
 * Bangla lessons type into a real text field (Bijoy and Avro compose
 * letters, so single key presses cannot be judged). Each screen's typed
 * text is sent to the server, which scores it against its own copy.
 */
export function BanglaLessonPlayer({ lessonId, lessonTitle, levelTitle, screens }: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState("");
  const [clock, setClock] = useState(0);
  const [snaps, setSnaps] = useState<ScreenSnapshot[]>([]);
  const [layout, setLayout] = useState<BanglaLayout>("bijoy");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const engineRef = useRef<TypingExamEngine | null>(null);

  const screen = screens[index];
  const text = screen.text;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY);
      if (saved === "avro" || saved === "bijoy") setLayout(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const chooseLayout = (l: BanglaLayout) => {
    setLayout(l);
    try {
      window.localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* ignore */
    }
  };

  // Fresh engine per screen.
  useEffect(() => {
    const ms = screen.type === "timed" ? (screen.seconds ?? 60) * 1000 : UNTIMED_MS;
    const engine = new TypingExamEngine(text, ms);
    engine.start(Date.now());
    engineRef.current = engine;
    setTyped("");
    setClock(0);
  }, [index, text, screen]);

  const finishScreen = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const s = engine.snapshot(Date.now());
    setSnaps((all) => {
      const next = all.slice(0, index);
      next[index] = {
        typedText: s.typedText,
        keystrokesTotal: s.keystrokes.total,
        keystrokesCorrect: s.keystrokes.correct,
        elapsedMs: Math.round(s.elapsedMs),
      };
      return next;
    });
    setPhase("screen_done");
  }, [index]);

  // Timed screens end on the clock.
  useEffect(() => {
    if (phase !== "typing" || screen.type !== "timed") return;
    const id = setInterval(() => {
      const engine = engineRef.current;
      const now = Date.now();
      if (engine?.tick(now)) finishScreen();
      setClock(now);
    }, 250);
    return () => clearInterval(id);
  }, [phase, screen, finishScreen]);

  const onChange = (value: string) => {
    const engine = engineRef.current;
    if (!engine || phase !== "typing") return;
    const now = Date.now();
    setTyped(engine.input(value, now));
    setClock(now);
    if (engine.finished) finishScreen();
  };

  const submit = useCallback(
    async (all: ScreenSnapshot[]) => {
      setPhase("submitting");
      try {
        const res = await fetch(`/api/typing-game/lessons/${lessonId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screens: all }),
        });
        const d = (await res.json()) as Outcome & { error?: string };
        if (!res.ok) throw new Error(d.error ?? String(res.status));
        setOutcome(d);
        setPhase("done");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "ERROR");
        setPhase("error");
      }
    },
    [lessonId],
  );

  const next = useCallback(() => {
    if (index + 1 < screens.length) {
      setIndex(index + 1);
      setPhase("typing");
    } else void submit(snaps);
  }, [index, screens.length, snaps, submit]);

  const redo = () => {
    const ms = screen.type === "timed" ? (screen.seconds ?? 60) * 1000 : UNTIMED_MS;
    const engine = new TypingExamEngine(text, ms);
    engine.start(Date.now());
    engineRef.current = engine;
    setTyped("");
    setPhase("typing");
  };

  useEffect(() => {
    if (phase !== "screen_done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, next]);

  // Next grapheme to type + how to type it on the chosen layout.
  const hint = useMemo(() => {
    const at = caretIndex(text, typed);
    const rest = text.slice(at);
    const cluster = graphemes(rest).find((g) => g.trim().length > 0) ?? "";
    return cluster ? { cluster, keys: typingHint(cluster, layout) } : null;
  }, [text, typed, layout]);

  const engine = engineRef.current;
  const live = useMemo(() => {
    if (!engine || !engine.started) return null;
    const s = engine.snapshot(clock || Date.now());
    return scoreAttempt({ originalText: text, typedText: s.typedText, elapsedMs: s.elapsedMs, keystrokes: s.keystrokes });
    // typed mirrors the engine text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, text, typed, clock]);
  const timeLeft = screen.type === "timed" && engine ? Math.ceil(engine.remainingMs(clock || Date.now()) / 1000) : null;
  const done = snaps[index];
  const doneScore = done
    ? scoreAttempt({
        originalText: text,
        typedText: done.typedText,
        elapsedMs: done.elapsedMs,
        keystrokes: { total: done.keystrokesTotal, correct: done.keystrokesCorrect },
      })
    : null;

  if (phase === "done" && outcome) {
    const r = outcome.result;
    return (
      <div className="tap-card mx-auto flex max-w-xl flex-col items-center gap-4 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{levelTitle}</p>
        <h2 className="font-display text-2xl font-extrabold">{lessonTitle} — সম্পূর্ণ!</h2>
        <Stars n={r.stars} size="h-10 w-10" />
        <p className="text-sm text-ink-muted">
          Speed <b>{Math.round(r.wpm)} wpm</b> · Accuracy <b>{Math.round(r.accuracy)}%</b> · Time <b>{fmt(r.elapsedMs)}</b>
        </p>
        {outcome.xp > 0 ? <span className="tap-badge tap-badge-legendary">+{outcome.xp} XP</span> : null}
        <div className="flex flex-wrap justify-center gap-2">
          {outcome.nextLessonId ? (
            <Link href={`${LESSONS_HREF}/${outcome.nextLessonId}`} className="tap-btn tap-btn-primary tap-btn-md">
              পরের লেসন <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          <button type="button" className="tap-btn tap-btn-secondary tap-btn-md" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> আবার করুন
          </button>
          <Link href={`${LESSONS_HREF}?mode=bn`} className="tap-btn tap-btn-ghost tap-btn-md">
            সব লেসন
          </Link>
        </div>
        <AdSlot slot="result" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{levelTitle}</p>
          <h1 className="font-display text-xl font-bold">{lessonTitle}</h1>
        </div>
        <div role="radiogroup" aria-label="Keyboard layout" className="tap-tablist">
          {(["bijoy", "avro"] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={layout === l} className={`tap-tab ${layout === l ? "tap-tab-active" : ""}`} onClick={() => chooseLayout(l)}>
              {l === "bijoy" ? "Bijoy" : "Avro"}
            </button>
          ))}
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

      <div className="tap-card flex flex-col gap-4 p-5 sm:p-6">
        {phase === "error" ? (
          <div className="text-center">
            <p className="font-semibold">ফল সেভ করা যায়নি ({errorMsg})।</p>
            <button type="button" className="tap-btn tap-btn-primary tap-btn-sm mt-3" onClick={() => void submit(snaps)}>
              আবার চেষ্টা করুন
            </button>
          </div>
        ) : phase === "submitting" ? (
          <div className="tap-spinner mx-auto" aria-label="Saving" />
        ) : phase === "screen_done" && doneScore ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Stars n={starsFor(doneScore.accuracy)} size="h-9 w-9" />
            <p className="text-sm text-ink-muted">
              Speed <b>{Math.round(doneScore.wpm)} wpm</b> · Accuracy <b>{Math.round(doneScore.accuracy)}%</b> · Time <b>{fmt(done!.elapsedMs)}</b>
            </p>
            <div className="flex gap-2">
              <button type="button" className="tap-btn tap-btn-secondary tap-btn-md" onClick={redo}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Redo
              </button>
              <button type="button" className="tap-btn tap-btn-primary tap-btn-md" onClick={next}>
                {index + 1 < screens.length ? "Continue" : "Finish lesson"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-ink-muted">
              <span>{screen.title}</span>
              <span className="flex items-center gap-4">
                {live ? (
                  <span>
                    <b className="tabular-nums">{Math.round(live.wpm)}</b> wpm · <b className="tabular-nums">{Math.round(live.accuracy)}%</b>
                  </span>
                ) : null}
                {timeLeft !== null ? (
                  <span className="font-display text-2xl font-bold tabular-nums" style={{ color: "var(--tap-primary-600)" }}>
                    {engine?.started ? timeLeft : screen.seconds}s
                  </span>
                ) : null}
              </span>
            </div>
            {screen.type === "key_intro" ? (
              <p className="text-center font-display text-6xl font-bold" lang="bn">
                {text}
              </p>
            ) : null}
            <TypingField examText={text} typedText={typed} onChange={onChange} disabled={false} />
            {hint ? (
              <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl px-4 py-3" style={{ background: "var(--tap-primary-50)" }}>
                <span className="text-sm text-ink-muted">পরের অক্ষর</span>
                <span className="font-display text-3xl font-bold" lang="bn">
                  {hint.cluster}
                </span>
                <span className="text-sm text-ink-muted">{layout === "bijoy" ? "Bijoy-তে চাপুন" : "Avro-তে লিখুন"}</span>
                <span className="flex gap-1">
                  {hint.keys.split(" ").map((k, i) => (
                    <kbd key={i} className="tap-kbd px-2 py-1 font-mono text-base">
                      {k}
                    </kbd>
                  ))}
                </span>
              </div>
            ) : null}
            <p className="text-center text-xs text-ink-faint">
              কম্পিউটারে {layout === "bijoy" ? "Bijoy" : "Avro (Phonetic)"} চালু করে লিখুন
              {layout === "avro" ? " · Avro-র auto-correct বন্ধ রাখুন" : " · বড় হাতের অক্ষর মানে Shift চেপে"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
