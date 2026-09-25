"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Flag, Link2, Shield, Users, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Alert, GameHudShell, ProgressBar, ProgressRing } from "@/components/typing-game/ui";
import {
  createTypingSession,
  type GameMechanic,
  type TypingSession,
  type TypingSnapshot,
} from "@/lib/typing-game/game-engine";
import {
  digestOf,
  encodeTimeline,
  isRealMechanic,
  runMechanic,
  type MechanicOutcome,
  type MechanicParams,
  type MechanicUnit,
} from "@/lib/typing-game/mechanics";
import {
  MechanicStage,
  mechanicEndMessage,
  type MechanicStageStrings,
} from "./mechanics/mechanic-stage";
import type { ProgressionSummary } from "@/lib/typing-game/server/attempt-store";

export interface PlayStrings {
  tapToFocus: string;
  timeLeft: string;
  wpm: string;
  accuracy: string;
  combo: string;
  progress: string;
  pause: string;
  resume: string;
  restart: string;
  quit: string;
  submitting: string;
  expired: string;
  failedToSubmit: string;
  focusLost: string;
  screenReaderProgress: string;
  mechanicCheckpoints: string;
  mechanicRelay: string;
  mechanicChain: string;
  mechanicWaves: string;
  mechanicShield: string;
  mechanicTargets: string;
  /** Mechanic HUD labels (real mechanics only). */
  stage: MechanicStageStrings;
}

export interface SubmitSnapshot {
  typedText: string;
  elapsedMs: number;
  corrections: number;
  errorStrokes: number;
  incorrectChars: number;
}

export interface ValidatedResult {
  score: number;
  accuracy: number;
  effectiveWpm: number;
  progression: ProgressionSummary | null;
  /**
   * The SERVER's mechanic replay, not the browser's. Present only for the
   * ten mechanics with real rules, and display-only — it never contributed
   * to score, accuracy or WPM above.
   */
  mechanic?: MechanicOutcome | null;
  /**
   * Custom-mission-only fields (undefined for catalog games): whether THIS
   * attempt met the mission's own accuracy/WPM/time gates, and whether the
   * mission's completion rule (once/timed/repetitions) is now satisfied.
   */
  qualifies?: boolean;
  completed?: boolean;
  newlyCompleted?: boolean;
}

type Phase =
  | "ready"
  | "playing"
  | "paused"
  | "submitting"
  | "done"
  | "rejected"
  | "expired"
  | "error";

/**
 * Purely decorative ambient layer behind the typing text. Rendered once per
 * mechanic (stable via useMemo keyed on the prompt), animated with CSS only
 * — never re-computed per keystroke, never affects scoring.
 */
function MechanicAmbient({
  mechanic,
  expected,
}: {
  mechanic: GameMechanic;
  expected: string[];
}) {
  const glyphs = useMemo(() => {
    if (mechanic !== "falling-catch") return [];
    const pool = Array.from(new Set(expected.filter((c) => c.trim().length > 0)));
    return pool.slice(0, 7).map((ch, i) => ({
      ch,
      left: (i * 14 + 6) % 90,
      duration: 5 + (i % 4),
      delay: -(i * 1.4),
    }));
  }, [mechanic, expected]);

  if (mechanic === "falling-catch") {
    return (
      <div className="tap-mech-ambient" aria-hidden="true">
        {glyphs.map((g, i) => (
          <span
            key={i}
            className="tap-mech-fall-glyph"
            style={{
              left: `${String(g.left)}%`,
              animationDuration: `${String(g.duration)}s`,
              animationDelay: `${String(g.delay)}s`,
            }}
          >
            {g.ch}
          </span>
        ))}
      </div>
    );
  }
  if (mechanic === "escape-run") {
    return (
      <div className="tap-mech-ambient" aria-hidden="true">
        <span className="tap-mech-corridor tap-mech-corridor-left" />
        <span className="tap-mech-corridor tap-mech-corridor-right" />
      </div>
    );
  }
  if (mechanic === "target-press" || mechanic === "collection") {
    return (
      <div className="tap-mech-ambient" aria-hidden="true">
        <span className="tap-mech-ping" />
        <span className="tap-mech-ping tap-mech-ping-2" />
      </div>
    );
  }
  return null;
}

function SegmentedMeta({
  label,
  Icon,
  total,
  filled,
}: {
  label: string;
  Icon: LucideIcon;
  total: number;
  filled: number;
}) {
  return (
    <div className="tap-mech-meta">
      <Icon className="tap-mech-meta-icon" aria-hidden="true" size={15} />
      <span>{label}</span>
      <span
        className="tap-mech-dots"
        role="img"
        aria-label={`${String(filled)}/${String(total)}`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={i < filled ? "tap-mech-dot tap-mech-dot-filled" : "tap-mech-dot"}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * Thin per-mechanic meta strip under the typing box — always derived from
 * real, already-computed live numbers (snapshot / live accuracy). Never
 * invents a value that isn't already shown elsewhere in the HUD.
 */
function MechanicMeta({
  mechanic,
  snap,
  liveAcc,
  s,
}: {
  mechanic: GameMechanic;
  snap: TypingSnapshot;
  liveAcc: number;
  s: PlayStrings;
}) {
  switch (mechanic) {
    case "race-checkpoints":
    case "relay-team":
    case "sequence-build": {
      const total = 5;
      const filled = Math.round((snap.completionPct / 100) * total);
      const label =
        mechanic === "relay-team"
          ? s.mechanicRelay
          : mechanic === "sequence-build"
            ? s.mechanicChain
            : s.mechanicCheckpoints;
      const Icon = mechanic === "relay-team" ? Users : mechanic === "sequence-build" ? Link2 : Flag;
      return <SegmentedMeta label={label} Icon={Icon} total={total} filled={filled} />;
    }
    case "survival-waves":
    case "endless": {
      const total = 5;
      const filled = Math.min(total, Math.floor(snap.maxCombo / 10));
      return <SegmentedMeta label={s.mechanicWaves} Icon={Waves} total={total} filled={filled} />;
    }
    case "target-press":
    case "collection": {
      const total = 5;
      const filled = Math.round((snap.completionPct / 100) * total);
      return <SegmentedMeta label={s.mechanicTargets} Icon={Crosshair} total={total} filled={filled} />;
    }
    case "defense-shield":
      return (
        <div className="tap-mech-meta">
          <Shield className="tap-mech-meta-icon" aria-hidden="true" size={15} />
          <span>{s.mechanicShield}</span>
          <div className="w-28">
            <ProgressBar value={liveAcc} max={100} label={s.mechanicShield} />
          </div>
        </div>
      );
    case "accuracy-trial":
      return (
        <div className="tap-mech-ring-wrap">
          <ProgressRing value={liveAcc} max={100} size={40} label={s.accuracy} />
          <span className="tap-mech-ring-value" aria-hidden="true">
            {Math.round(liveAcc)}%
          </span>
        </div>
      );
    default:
      return null;
  }
}

/**
 * Reusable play shell (M6). ONE shell for every game: definition in, server
 * verdict out. Typing state lives in refs (no app-wide rerenders, no
 * per-keystroke network); the ONLY request is the final submit.
 */
export function GamePlayer({
  attemptId,
  gameSlug,
  gameTitle,
  expectedText,
  timingKind,
  timingLimit,
  visual,
  mechanic,
  inputRules,
  mechanicRuntime,
  strings: s,
  backHref,
  onDone,
  submitUrl,
}: {
  attemptId: string;
  gameSlug: string;
  gameTitle: string;
  expectedText: string;
  timingKind: string;
  timingLimit: number | null;
  visual: string;
  mechanic: GameMechanic;
  /**
   * Per-game typing rules from the catalog. Previously hard-coded to
   * permissive defaults here, which silently contradicted every game
   * declaring allowBackspace:false or caseSensitive:false.
   */
  inputRules?: { allowBackspace: boolean; caseSensitive: boolean };
  /**
   * Units + params for a real mechanic, or null for the shell mechanics.
   * Computed server-side so a mid-attempt refresh rebuilds the same run.
   */
  mechanicRuntime?: { units: MechanicUnit[]; params: MechanicParams } | null;
  strings: PlayStrings;
  backHref: string;
  onDone: (result: ValidatedResult | null, snap: SubmitSnapshot, extra: { rejectedReason: string | null; expired: boolean }) => void;
  /**
   * Override the default catalog submit endpoint. Used by custom missions,
   * which submit to /api/typing-game/custom-missions/[id]/attempts/[attemptId]/submit
   * instead of the catalog games route. The typing shell, HUD and scoring
   * display are otherwise identical between the two.
   */
  submitUrl?: string;
}) {
  const sessionRef = useRef<TypingSession | null>(null);
  /**
   * ms offset of every committed character, parallel to the typed buffer.
   * This is the evidence that makes timing-based mechanics verifiable: the
   * server replays the mechanic over it rather than believing an outcome the
   * browser reports. Backspace pops it in lockstep with the session buffer.
   */
  const timelineRef = useRef<number[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const sessionOpts = useMemo(
    () => ({
      allowBackspace: inputRules?.allowBackspace ?? true,
      caseSensitive: inputRules?.caseSensitive ?? true,
    }),
    [inputRules?.allowBackspace, inputRules?.caseSensitive],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);
  const endAtRef = useRef(0);  const [phase, setPhase] = useState<Phase>("ready");
  const [tick, setTick] = useState(0);
  const [focused, setFocused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(timingLimit ?? 0);
  const [announcement, setAnnouncement] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const expected = useMemo(() => Array.from(expectedText), [expectedText]);

  if (!sessionRef.current) {
    sessionRef.current = createTypingSession(expectedText, sessionOpts);
  }

  // Reset the session when the prompt changes (e.g. client-side navigation
  // reuses this component for a different attempt without remounting).
  // Without this, keystrokes would be scored against the previous prompt.
  const lastExpectedRef = useRef(expectedText);
  useEffect(() => {
    if (lastExpectedRef.current !== expectedText) {
      lastExpectedRef.current = expectedText;
      sessionRef.current = createTypingSession(expectedText, sessionOpts);
      timelineRef.current = [];
      startedAtRef.current = null;
      endAtRef.current = 0;
      submittedRef.current = false;
      setSecondsLeft(timingLimit ?? 0);
      setSubmitError(null);
      setPhase("ready");
      setTick((t) => t + 1);
    }
  }, [expectedText, timingLimit, sessionOpts]);

  const snap = sessionRef.current.snapshot();
  const typedChars = useMemo(
    () => Array.from(sessionRef.current?.getTypedText() ?? ""),
    [tick],
  );
  /**
   * The live mechanic state. Same pure function the route handler runs on
   * submit, fed the buffer so far — so what the player sees during the run
   * and what the server decides afterwards can never disagree.
   */
  const mechanicOutcome: MechanicOutcome | null = useMemo(() => {
    if (!mechanicRuntime || !isRealMechanic(mechanic)) return null;
    return runMechanic({
      mechanic,
      expected,
      typed: typedChars,
      timeline: timelineRef.current.slice(0, typedChars.length),
      units: mechanicRuntime.units,
      params: mechanicRuntime.params,
      caseSensitive: sessionOpts.caseSensitive,
    });
    // typedChars is rebuilt per keystroke (keyed on tick), which is what
    // drives this recompute.
  }, [mechanic, mechanicRuntime, expected, typedChars, sessionOpts.caseSensitive]);

  /** A mechanic rule ended the run (not merely "not finished yet"). */
  const mechanicFailed =
    mechanicOutcome !== null &&
    mechanicOutcome.endReason !== "completed" &&
    mechanicOutcome.endReason !== "incomplete";

  const minutes = snap.elapsedMs > 0 ? snap.elapsedMs / 60000 : 0;
  const liveWpm = minutes > 0 ? snap.correctChars / 5 / minutes : 0;
  const liveAcc =
    snap.typedLength > 0 ? (snap.correctChars / snap.typedLength) * 100 : 100;

  const focusInput = (): void => {
    inputRef.current?.focus({ preventScroll: true });
  };

  async function submit(): Promise<void> {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const session = sessionRef.current;
    if (!session) return;
    const final = session.snapshot();
    const payload = {
      typedText: session.getTypedText(),
      elapsedMs: final.elapsedMs,
      corrections: final.corrections,
      errorStrokes: final.errorStrokes,
      // Deltas keep this small; the server decodes, sanity-checks and
      // replays it. Omitted entirely for the shell mechanics.
      ...(mechanicRuntime
        ? {
            timeline: encodeTimeline(
              timelineRef.current.slice(0, final.typedLength),
            ),
            // Advisory only: the server compares it against its own replay
            // to flag a disagreement, and always stores its own verdict.
            ...(mechanicOutcome ? { mechanicDigest: digestOf(mechanicOutcome) } : {}),
          }
        : {}),
    };
    setPhase("submitting");
    setAnnouncement(s.submitting);
    try {
      const url =
        submitUrl ??
        `/api/typing-game/games/${encodeURIComponent(gameSlug)}/attempts/${encodeURIComponent(attemptId)}/submit`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 410) {
        setPhase("expired");
        setAnnouncement(s.expired);
        onDone(null, { ...payload, incorrectChars: final.incorrectChars }, { rejectedReason: null, expired: true });
        return;
      }
      if (res.status === 409) {
        // Rare race (double submit): the run is recorded; stop here with
        // links instead of inventing a result.
        setPhase("error");
        setSubmitError(s.failedToSubmit);
        setAnnouncement(s.failedToSubmit);
        return;
      }
      if (!res.ok) throw new Error(`submit ${String(res.status)}`);
      const body = (await res.json()) as {
        status: string;
        score?: number;
        accuracy?: number;
        effectiveWpm?: number;
        reason?: string | null;
        progression?: ValidatedResult["progression"];
        mechanic?: MechanicOutcome | null;
        qualifies?: boolean;
        completed?: boolean;
        newlyCompleted?: boolean;
      };
      if (body.status === "validated") {
        setPhase("done");
        setAnnouncement(s.screenReaderProgress);
        onDone(
          {
            score: body.score ?? 0,
            accuracy: body.accuracy ?? 0,
            effectiveWpm: body.effectiveWpm ?? 0,
            progression: body.progression ?? null,
            mechanic: body.mechanic ?? null,
            qualifies: body.qualifies,
            completed: body.completed,
            newlyCompleted: body.newlyCompleted,
          },
          { ...payload, incorrectChars: final.incorrectChars },
          { rejectedReason: null, expired: false },
        );
      } else if (body.status === "expired") {
        // Custom-mission submit signals expiry via body.status (HTTP 200),
        // unlike the catalog route's HTTP 410 — handle both shapes.
        setPhase("expired");
        setAnnouncement(s.expired);
        onDone(null, { ...payload, incorrectChars: final.incorrectChars }, { rejectedReason: null, expired: true });
      } else {
        setPhase("rejected");
        onDone(null, { ...payload, incorrectChars: final.incorrectChars }, { rejectedReason: body.reason ?? "REJECTED", expired: false });
      }
    } catch {
      submittedRef.current = false;
      setPhase("error");
      setSubmitError(s.failedToSubmit);
      setAnnouncement(s.failedToSubmit);
    }
  }
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // A broken mechanic rule ends the run immediately — the player is out of
  // lives, caught, or their shield is down. Submitting here (rather than
  // letting them type on) is also what keeps the client's replay aligned
  // with the server's: both stop at the same character.
  useEffect(() => {
    if (phase !== "playing" || !mechanicFailed || !mechanicOutcome) return;
    setAnnouncement(
      mechanicEndMessage(mechanicOutcome, s.stage) ?? s.screenReaderProgress,
    );
    void submitRef.current();
  }, [phase, mechanicFailed, mechanicOutcome, s.stage, s.screenReaderProgress]);

  // Countdown clock (display only — server expiry is authoritative).
  useEffect(() => {
    if (timingKind !== "countdown" || !timingLimit || phase !== "playing") {
      return;
    }
    if (!endAtRef.current) {
      endAtRef.current = Date.now() + timingLimit * 1000;
    }
    const id = window.setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((endAtRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        setAnnouncement(s.expired);
        void submitRef.current();
      }
    }, 250);
    return () => { window.clearInterval(id); };
  }, [phase, timingKind, timingLimit, s.expired]);

  function feedKey(key: string): void {
    const session = sessionRef.current;
    // Terminal phases (submitting/done/rejected/expired/error) never accept
    // input — the run is already finalized or being finalized server-side.
    if (!session || (phase !== "ready" && phase !== "playing" && phase !== "paused")) return;
    if (phase === "ready" || phase === "paused") setPhase("playing");
    const now = Date.now();
    if (startedAtRef.current === null) startedAtRef.current = now;
    const outcome = session.input(key, now);
    if (outcome.accepted) {
      timelineRef.current.push(now - startedAtRef.current);
    }
    setTick((t) => t + 1);
    if (outcome.accepted && outcome.done) {
      setAnnouncement(s.screenReaderProgress);
      void submitRef.current();
    }
  }

  function feedBackspace(): void {
    const session = sessionRef.current;
    if (!session || (phase !== "ready" && phase !== "playing" && phase !== "paused")) return;
    if (phase === "ready" || phase === "paused") setPhase("playing");
    const removed = session.backspace(Date.now());
    if (removed.accepted) timelineRef.current.pop();
    setTick((t) => t + 1);
  }

  function restart(): void {
    sessionRef.current = createTypingSession(expectedText, sessionOpts);
    timelineRef.current = [];
    startedAtRef.current = null;
    endAtRef.current = 0;
    submittedRef.current = false;
    setSecondsLeft(timingLimit ?? 0);
    setSubmitError(null);
    setPhase("ready");
    setTick((t) => t + 1);
    focusInput();
  }

  const currentChar = expected[typedChars.length] ?? "";
  const showPause = timingKind === "untimed" && (phase === "playing" || phase === "paused");
  const pulseMechanic = mechanic === "time-trial" || mechanic === "duel-rounds";
  const urgent =
    pulseMechanic &&
    timingKind === "countdown" &&
    !!timingLimit &&
    secondsLeft <= 10 &&
    phase === "playing";
  const previewClassName = [
    "tap-preview",
    pulseMechanic && phase === "playing" ? "tap-preview-pulse" : "",
    urgent ? "tap-preview-urgent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-4" data-visual={visual} data-mechanic={mechanic}>
      <GameHudShell
        label={gameTitle}
        score={<span>{Math.round(liveWpm)} {s.wpm}</span>}
        accuracy={<span>{Math.round(liveAcc)}%</span>}
        streak={snap.combo > 1 ? <span>{s.combo}: {snap.combo}</span> : undefined}
        timer={
          timingKind === "countdown" && timingLimit ? (
            <span>{s.timeLeft.replace("{seconds}", String(secondsLeft))}</span>
          ) : undefined
        }
        actions={
          <>
            {showPause ? (
              <button
                type="button"
                className="tap-btn tap-btn-secondary tap-btn-sm"
                onClick={() => {
                  setPhase(phase === "playing" ? "paused" : "playing");
                  if (phase === "paused") focusInput();
                }}
              >
                {phase === "playing" ? s.pause : s.resume}
              </button>
            ) : null}
            <button
              type="button"
              className="tap-btn tap-btn-secondary tap-btn-sm"
              onClick={restart}
              disabled={phase === "submitting"}
            >
              {s.restart}
            </button>
            <a href={backHref} className="tap-btn tap-btn-ghost tap-btn-sm">
              {s.quit}
            </a>
          </>
        }
      >
        <div className="w-full">
          <div
            className={previewClassName}
            role="textbox"
            aria-label={`${gameTitle}. ${s.tapToFocus}`}
            aria-readonly="true"
            tabIndex={-1}
            onClick={focusInput}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                feedBackspace();
              }
            }}
          >
            <MechanicAmbient mechanic={mechanic} expected={expected} />
            <p className="tap-preview-text max-w-2xl px-6 font-mono text-xl leading-9 md:text-2xl md:leading-10">
              {expected.map((ch, i) => {
                const typed = typedChars[i];
                const cls =
                  typed === undefined
                    ? i === typedChars.length
                      ? "tap-char-current"
                      : "tap-char-todo"
                    : typed === ch
                      ? "tap-char-ok"
                      : "tap-char-bad";
                return (
                  <span key={i} className={cls}>
                    {ch === " " ? " " : ch}
                  </span>
                );
              })}
            </p>
            {!focused && phase !== "done" ? (
              <div className="tap-preview-overlay">
                <button
                  type="button"
                  className="tap-btn tap-btn-primary tap-btn-md"
                  onClick={focusInput}
                >
                  {phase === "paused" ? s.resume : s.tapToFocus}
                </button>
              </div>
            ) : null}
          </div>
          <input
            ref={inputRef}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              e.target.value = "";
              if (!v) return;
              for (const ch of Array.from(v).slice(0, 8)) feedKey(ch);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                feedBackspace();
              }
              if (e.key === "Tab") e.preventDefault();
            }}
            onFocus={() => { setFocused(true); }}
            onBlur={() => {
              setFocused(false);
              if (phase === "playing") setAnnouncement(s.focusLost);
            }}
            className="sr-only"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={s.tapToFocus}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {mechanicOutcome && mechanicRuntime ? (
              <MechanicStage
                outcome={mechanicOutcome}
                params={mechanicRuntime.params}
                units={mechanicRuntime.units}
                strings={s.stage}
              />
            ) : (
              <MechanicMeta mechanic={mechanic} snap={snap} liveAcc={liveAcc} s={s} />
            )}
            <div className="flex items-center gap-3">
              <p className="text-sm text-ink-muted">
                {s.progress}: {Math.round(snap.completionPct)}%
              </p>
              {currentChar ? (
                <p className="text-sm">
                  <kbd className="tap-kbd">{currentChar === " " ? "Space" : currentChar}</kbd>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </GameHudShell>

      <p role="status" aria-live="polite" className="tap-sr-only">
        {announcement}
      </p>

      {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
      {phase === "error" ? (
        <button
          type="button"
          className="tap-btn tap-btn-secondary tap-btn-md self-start"
          onClick={() => {
            setSubmitError(null);
            setPhase("playing");
            focusInput();
          }}
        >
          {s.resume}
        </button>
      ) : null}
    </div>
  );
}
