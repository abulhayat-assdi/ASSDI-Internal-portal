"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Settings2, SkipForward, Trophy } from "lucide-react";
import TypingField from "@/components/typing-exam/TypingField";
import { TypingExamEngine } from "@/lib/typing-exam/engine";
import { scoreAttempt, type ScoreResult } from "@/lib/typing-exam/scoring";
import { caretIndex } from "@/lib/typing-exam/words";
import type {
  CaseMode,
  PracticeDifficulty,
  PracticeLanguage,
  PunctuationMode,
} from "@/lib/typing-game/practice/transform";
import {
  bestKey,
  loadBests,
  loadConfig,
  saveBest,
  saveConfig,
  DEFAULT_CONFIG,
  type PracticeConfig,
  type PracticeMode,
} from "./practice-config";
import { WpmChart } from "./wpm-chart";

export interface PracticeCategoryOption {
  value: string;
  label: string;
}
export interface PracticeArticleOption {
  id: string;
  title: string;
  category: string;
  words: number;
}

interface Props {
  categories: Record<PracticeLanguage, PracticeCategoryOption[]>;
  articles: Record<PracticeLanguage, PracticeArticleOption[]>;
  /** False until the student passes English Level 1 (Bangla mode gate). */
  banglaUnlocked: boolean;
}

const DURATIONS = [15, 30, 60, 120];
const WORD_COUNTS = [10, 25, 50, 100];
const DIFFICULTY_LABEL: Record<PracticeDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  pro: "Pro",
  expert: "Expert",
};
const DIFFICULTY_HINT: Record<PracticeLanguage, Record<PracticeDifficulty, string>> = {
  en: {
    beginner: "সব ছোট হাতের অক্ষর, কোনো চিহ্ন বা সংখ্যা নেই",
    intermediate: "বাক্যের শুরু বড় হাতের, শুধু . আর ,",
    pro: "Capitalize Each Word, ? ! ; : ' \" - আর সংখ্যা",
    expert: "বড়-ছোট মিশ্র অক্ষর, ব্র্যাকেট, সব চিহ্ন ও সংখ্যা",
  },
  bn: {
    beginner: "যুক্তাক্ষর ছাড়া শব্দ, কোনো চিহ্ন নেই",
    intermediate: "সব শব্দ, শুধু । আর ,",
    pro: "সব শব্দ, ? ! ; : - আর সংখ্যা",
    expert: "লেখা হুবহু, সব চিহ্ন ও সংখ্যা",
  },
};
const CASE_LABEL: Record<CaseMode, string> = {
  lower: "lowercase",
  sentence: "Sentence case",
  title: "Capitalize Each Word",
  mixed: "MiXed Case",
  original: "Original",
};
const PUNCT_LABEL: Record<PunctuationMode, string> = {
  none: "None",
  basic: ". ,",
  standard: ". , ? ! ; : ' \" -",
  full: "All ( ) [ ] / & …",
};
/** An open-ended words/article run still needs a ceiling for the engine. */
const UNTIMED_LIMIT_SECONDS = 3600;
const TICK_MS = 200;
/** Bordered compact field for the settings bar (tap-input is a bare inner field). */
const FIELD =
  "rounded-lg border bg-[var(--tap-surface-solid)] px-2 py-1.5 text-sm text-[var(--tap-ink)] border-[var(--tap-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--tap-primary-300)]";

type Phase = "loading" | "ready" | "running" | "done" | "error";

interface RunResult extends ScoreResult {
  elapsedMs: number;
  samples: number[];
  isBest: boolean;
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="tap-tablist flex-wrap">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`tap-tab ${o.value === value ? "tap-tab-active" : ""} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PracticeTyper({ categories, articles, banglaUnlocked }: Props) {
  const [config, setConfigState] = useState<PracticeConfig>(DEFAULT_CONFIG);
  const [customOpen, setCustomOpen] = useState(false);
  const [customSeconds, setCustomSeconds] = useState("");
  const [text, setText] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [typed, setTyped] = useState("");
  const [clock, setClock] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const engineRef = useRef<TypingExamEngine | null>(null);
  const samplesRef = useRef<number[]>([]);
  const finishedRef = useRef(false);

  // Restore the last settings once on the client (never during SSR).
  useEffect(() => {
    const saved = loadConfig();
    setConfigState(saved.language === "bn" && !banglaUnlocked ? { ...saved, language: "en" } : saved);
  }, [banglaUnlocked]);

  const setConfig = useCallback((patch: Partial<PracticeConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  const durationSeconds = config.mode === "time" ? config.seconds : UNTIMED_LIMIT_SECONDS;
  const runKey = bestKey(config);

  const resetEngine = useCallback(
    (forText: string) => {
      const engine = new TypingExamEngine(forText, durationSeconds * 1000);
      engine.start(Date.now());
      engineRef.current = engine;
      samplesRef.current = [];
      finishedRef.current = false;
      setTyped("");
      setClock(0);
      setResult(null);
      setPhase("ready");
    },
    [durationSeconds],
  );

  // Fetch fresh text whenever the settings or the seed change.
  useEffect(() => {
    const controller = new AbortController();
    const words =
      config.mode === "words"
        ? config.words
        : config.mode === "time"
          ? Math.ceil((config.seconds / 60) * 160) + 20
          : 2500;
    const q = new URLSearchParams({
      lang: config.language,
      difficulty: config.difficulty,
      words: String(words),
    });
    if (seed > 0) q.set("seed", String(seed));
    if (config.category) q.set("category", config.category);
    if (config.mode === "article" && config.articleId) q.set("article", config.articleId);
    if (config.custom) {
      q.set("case", config.custom.case);
      q.set("punct", config.custom.punctuation);
      q.set("numbers", config.custom.numbers ? "1" : "0");
    }
    setPhase("loading");
    fetch(`/api/typing-game/practice/text?${q.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { text: string; sources: string[] }) => {
        if (!data.text) throw new Error("empty");
        setText(data.text);
        setSources(data.sources);
        resetEngine(data.text);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== "AbortError") setPhase("error");
      });
    return () => controller.abort();
  }, [config, seed, resetEngine]);

  const finish = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || finishedRef.current) return;
    finishedRef.current = true;
    const snap = engine.snapshot(Date.now());
    const score = scoreAttempt({
      originalText: text,
      typedText: snap.typedText,
      elapsedMs: snap.elapsedMs,
      keystrokes: snap.keystrokes,
    });
    const isBest = score.correctChars > 0 && saveBest(runKey, score.wpm, score.accuracy);
    setResult({ ...score, elapsedMs: snap.elapsedMs, samples: samplesRef.current.slice(), isBest });
    // Practice time counts towards today's goal (best-effort).
    if (snap.elapsedMs > 0) {
      void fetch("/api/typing-game/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ms: Math.round(snap.elapsedMs) }),
      }).catch(() => {});
    }
    setPhase("done");
  }, [text, runKey]);

  // Clock: drives the timer, the per-second WPM samples and the time-up end.
  useEffect(() => {
    if (phase !== "running") return;
    const engine = engineRef.current;
    if (!engine) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (engine.tick(now)) {
        finish();
        return;
      }
      const snap = engine.snapshot(now);
      const second = Math.floor(snap.elapsedMs / 1000);
      if (second > samplesRef.current.length) {
        const s = scoreAttempt({ originalText: text, typedText: snap.typedText, elapsedMs: snap.elapsedMs });
        samplesRef.current.push(Math.round(s.wpm));
      }
      setClock(now);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, finish, text]);

  const onType = (value: string) => {
    const engine = engineRef.current;
    if (!engine || phase === "done" || phase === "loading") return;
    const now = Date.now();
    setTyped(engine.input(value, now));
    setClock(now);
    if (phase === "ready" && engine.started) setPhase("running");
    if (engine.finished) finish();
  };

  const restartSame = useCallback(() => resetEngine(text), [resetEngine, text]);
  const nextText = useCallback(() => setSeed(Math.floor(Math.random() * 1e9) + 1), []);

  // Esc restarts the same text (monkeytype's Tab is taken by the field's focus trap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        restartSame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restartSame]);

  const engine = engineRef.current;
  const live = useMemo(() => {
    if (!engine || !engine.started) return { wpm: 0, accuracy: 0 };
    const snap = engine.snapshot(clock || Date.now());
    return scoreAttempt({ originalText: text, typedText: snap.typedText, elapsedMs: snap.elapsedMs, keystrokes: snap.keystrokes });
    // typed mirrors the engine text; recompute on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, text, typed, clock]);

  const now = clock || Date.now();
  const timerSeconds =
    config.mode === "time"
      ? Math.ceil((engine?.remainingMs(now) ?? config.seconds * 1000) / 1000)
      : Math.floor((engine?.snapshot(now).elapsedMs ?? 0) / 1000);
  const progress = text ? Math.round((caretIndex(text, typed) / text.length) * 100) : 0;
  const bests = useMemo(() => loadBests(), [result]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = bests[runKey];

  const applyCustomSeconds = () => {
    const n = Number(customSeconds);
    if (Number.isInteger(n) && n >= 5 && n <= 3600) setConfig({ mode: "time", seconds: n });
  };

  const langArticles = articles[config.language].filter(
    (a) => !config.category || a.category === config.category,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Settings bar */}
      <div className="tap-card flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Language"
            value={config.language}
            onChange={(v) => setConfig({ language: v, category: null, articleId: null })}
            options={[
              { value: "en", label: "English" },
              {
                value: "bn",
                label: banglaUnlocked ? "বাংলা" : "বাংলা 🔒",
                disabled: !banglaUnlocked,
                title: banglaUnlocked ? undefined : "English Level 1 পাস করলে বাংলা খুলবে",
              },
            ]}
          />
          <Segmented
            label="Mode"
            value={config.mode}
            onChange={(v: PracticeMode) => setConfig({ mode: v })}
            options={[
              { value: "time", label: "Time" },
              { value: "words", label: "Words" },
              { value: "article", label: "Article" },
            ]}
          />
          {config.mode === "time" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Seconds"
                value={DURATIONS.includes(config.seconds) ? config.seconds : -1}
                onChange={(v) => v > 0 && setConfig({ seconds: v })}
                options={[
                  ...DURATIONS.map((d) => ({ value: d, label: `${d}s` })),
                  ...(DURATIONS.includes(config.seconds) ? [] : [{ value: -1, label: `${config.seconds}s` }]),
                ]}
              />
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyCustomSeconds();
                }}
              >
                <input
                  type="number"
                  min={5}
                  max={3600}
                  inputMode="numeric"
                  placeholder="Custom s"
                  aria-label="Custom seconds"
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(e.target.value)}
                  className={FIELD} style={{ width: "6rem" }}
                />
                <button type="submit" className="tap-btn tap-btn-secondary tap-btn-sm">
                  Set
                </button>
              </form>
            </div>
          ) : null}
          {config.mode === "words" ? (
            <Segmented
              label="Words"
              value={config.words}
              onChange={(v) => setConfig({ words: v })}
              options={WORD_COUNTS.map((w) => ({ value: w, label: String(w) }))}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Difficulty"
            value={config.custom ? ("custom" as PracticeDifficulty) : config.difficulty}
            onChange={(v) => setConfig({ difficulty: v, custom: null })}
            options={(Object.keys(DIFFICULTY_LABEL) as PracticeDifficulty[]).map((d) => ({
              value: d,
              label: DIFFICULTY_LABEL[d],
              title: DIFFICULTY_HINT[config.language][d],
            }))}
          />
          <button
            type="button"
            onClick={() => setCustomOpen((o) => !o)}
            aria-expanded={customOpen}
            className={`tap-btn tap-btn-sm ${config.custom ? "tap-btn-primary" : "tap-btn-ghost"}`}
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Custom
          </button>
          <select
            aria-label="Category"
            className={FIELD}
            value={config.category ?? ""}
            onChange={(e) => setConfig({ category: e.target.value || null, articleId: null })}
          >
            <option value="">All topics</option>
            {categories[config.language].map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {config.mode === "article" ? (
            <select
              aria-label="Article"
              className={FIELD + " max-w-xs"}
              value={config.articleId ?? ""}
              onChange={(e) => setConfig({ articleId: e.target.value || null })}
            >
              <option value="">Random article</option>
              {langArticles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.words})
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <p className="text-xs text-ink-muted">
          {config.custom ? "Custom settings" : DIFFICULTY_HINT[config.language][config.difficulty]}
        </p>

        {customOpen ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed p-3" style={{ borderColor: "var(--tap-border-strong)" }}>
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Letters
              <select
                className={FIELD}
                value={config.custom?.case ?? "original"}
                onChange={(e) =>
                  setConfig({
                    custom: { case: e.target.value as CaseMode, punctuation: config.custom?.punctuation ?? "full", numbers: config.custom?.numbers ?? true },
                  })
                }
              >
                {(Object.keys(CASE_LABEL) as CaseMode[]).map((c) => (
                  <option key={c} value={c}>
                    {CASE_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Punctuation
              <select
                className={FIELD}
                value={config.custom?.punctuation ?? "full"}
                onChange={(e) =>
                  setConfig({
                    custom: { case: config.custom?.case ?? "original", punctuation: e.target.value as PunctuationMode, numbers: config.custom?.numbers ?? true },
                  })
                }
              >
                {(Object.keys(PUNCT_LABEL) as PunctuationMode[]).map((p) => (
                  <option key={p} value={p}>
                    {PUNCT_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={config.custom?.numbers ?? true}
                onChange={(e) =>
                  setConfig({
                    custom: { case: config.custom?.case ?? "original", punctuation: config.custom?.punctuation ?? "full", numbers: e.target.checked },
                  })
                }
              />
              Numbers
            </label>
            {config.custom ? (
              <button type="button" className="tap-btn tap-btn-ghost tap-btn-sm" onClick={() => setConfig({ custom: null })}>
                Reset to preset
              </button>
            ) : null}
          </div>
        ) : null}

        {config.language === "bn" ? (
          <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--tap-primary-50)", color: "var(--tap-primary-700)" }}>
            কম্পিউটারে Bijoy বা Avro চালু করে টাইপ করুন। Avro ব্যবহার করলে auto-correct / dictionary বন্ধ রাখুন।
          </p>
        ) : null}
      </div>

      {/* Typing area */}
      {phase === "error" ? (
        <div className="tap-card p-6 text-center">
          <p className="text-sm text-ink-muted">টেক্সট লোড করা যায়নি।</p>
          <button type="button" className="tap-btn tap-btn-primary tap-btn-sm mt-3" onClick={nextText}>
            আবার চেষ্টা করুন
          </button>
        </div>
      ) : phase === "done" && result ? (
        <div className="tap-card flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">wpm</p>
              <p className="font-display text-5xl font-extrabold tabular-nums" style={{ color: "var(--tap-primary-600)" }}>
                {Math.round(result.wpm)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">accuracy</p>
              <p className="font-display text-5xl font-extrabold tabular-nums">{Math.round(result.accuracy)}%</p>
            </div>
            {result.isBest ? (
              <span className="tap-badge tap-badge-legendary mb-2">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> New personal best
              </span>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-ink-faint">Raw WPM</dt>
              <dd className="font-bold tabular-nums">{Math.round(result.rawWpm)}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Characters</dt>
              <dd className="font-bold tabular-nums">
                {result.correctChars}/{result.totalChars}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Time</dt>
              <dd className="font-bold tabular-nums">{Math.round(result.elapsedMs / 1000)}s</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Best ({config.mode === "time" ? `${config.seconds}s` : config.mode})</dt>
              <dd className="font-bold tabular-nums">{best ? `${Math.round(best.wpm)} wpm` : "—"}</dd>
            </div>
          </dl>
          {result.samples.length > 1 ? <WpmChart samples={result.samples} /> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="tap-btn tap-btn-primary tap-btn-md" onClick={nextText}>
              <SkipForward className="h-4 w-4" aria-hidden="true" /> Next test
            </button>
            <button type="button" className="tap-btn tap-btn-secondary tap-btn-md" onClick={restartSame}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Repeat this text
            </button>
          </div>
        </div>
      ) : (
        <div className="tap-card flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-5">
              <span className="font-display text-4xl font-bold tabular-nums leading-none" style={{ color: "var(--tap-primary-600)" }}>
                {config.mode === "time" ? timerSeconds : `${timerSeconds}s`}
              </span>
              <span className="text-sm text-ink-muted">
                <span className="mr-1 text-xs uppercase text-ink-faint">wpm</span>
                <span className="font-bold tabular-nums">{Math.round(live.wpm)}</span>
              </span>
              <span className="text-sm text-ink-muted">
                <span className="mr-1 text-xs uppercase text-ink-faint">acc</span>
                <span className="font-bold tabular-nums">{Math.round(live.accuracy)}%</span>
              </span>
              {config.mode !== "time" ? (
                <span className="text-sm text-ink-muted">
                  <span className="mr-1 text-xs uppercase text-ink-faint">done</span>
                  <span className="font-bold tabular-nums">{progress}%</span>
                </span>
              ) : null}
            </div>
            <button type="button" onClick={nextText} className="tap-btn tap-btn-ghost tap-btn-sm" title="New text">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">New text</span>
            </button>
          </div>
          {phase === "loading" ? (
            <div className="tap-skeleton h-32 rounded-xl" />
          ) : (
            <TypingField examText={text} typedText={typed} onChange={onType} disabled={false} />
          )}
          <p className="text-center text-xs text-ink-faint">
            {phase === "ready" ? "প্রথম অক্ষর টাইপ করলেই সময় শুরু হবে · " : ""}Esc = আবার শুরু
            {sources.length > 0 ? ` · Source: ${sources.slice(0, 2).join(", ")}${sources.length > 2 ? "…" : ""}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
