/**
 * Mechanic runtime types — the contract shared by the browser (which PLAYS a
 * mechanic live) and the route handler (which REPLAYS it to verify).
 *
 * Trust model, continued from game-engine/validation.ts: the browser is never
 * believed. A mechanic outcome is a pure function of data the server already
 * holds or can check —
 *
 *     (expectedText, typedText, keystroke timeline, params)
 *
 * — so the server recomputes the same outcome from the same inputs and
 * compares digests. Nothing here may depend on a client-reported count that
 * the server cannot re-derive (notably `corrections` and `errorStrokes`,
 * which describe keystrokes that the final typed buffer no longer shows).
 *
 * UI-free and edge-safe: no React, no DOM, no I/O, no imports beyond types.
 */
import type { GameMechanic } from "@/lib/typing-game/game-engine";

/**
 * The mechanics with real gameplay rules. The remaining four
 * (`time-trial`, `accuracy-trial`, `duel-rounds`, `relay-team`) deliberately
 * stay on the shared typing shell: for the first two, "type the passage
 * against a clock" IS the honest mechanic and the shell already does it; the
 * last two need an opponent/ghost run and land with that feature.
 */
export const REAL_MECHANICS = [
  "target-press",
  "falling-catch",
  "sequence-build",
  "survival-waves",
  "race-checkpoints",
  "escape-run",
  "collection",
  "defense-shield",
  "boss-phased",
  "endless",
] as const;

export type RealMechanic = (typeof REAL_MECHANICS)[number];

export function isRealMechanic(mechanic: string): mechanic is RealMechanic {
  return (REAL_MECHANICS as readonly string[]).includes(mechanic);
}

/** Mechanics that keep the plain typing shell (no mechanic runtime). */
export function isShellMechanic(mechanic: GameMechanic): boolean {
  return !isRealMechanic(mechanic);
}

/**
 * One playable chunk of the prompt. Offsets index CODE POINTS of the
 * expected text (Array.from), matching how the typing session and
 * diffExpected already count, so a unit boundary never lands mid-surrogate.
 *
 * `end` is exclusive. The separator that follows a unit (a space, when the
 * prompt has words) belongs to no unit — it is a gap, typed but not scored
 * as part of either neighbour.
 */
export interface MechanicUnit {
  index: number;
  text: string;
  start: number;
  end: number;
}

/**
 * Resolved, difficulty-aware gameplay numbers. Every field is populated for
 * every mechanic (a mechanic simply ignores what it does not use), which
 * keeps the replay free of optional-field branching that could drift between
 * the two callers.
 */
export interface MechanicParams {
  /** Misses tolerated before the run ends. */
  lives: number;
  /**
   * The pace a run is timed against, in expected characters per second.
   *
   * Timing budgets are per-CHARACTER, not per-unit: a one-character target
   * must not get the same allowance as a five-character word. Budgeting per
   * unit made every timing gate inert on the letter games — a live run
   * measured that a player had to type slower than 2.5 seconds per character
   * before falling-catch would register a single miss.
   */
  targetCharsPerSec: number;
  /** Fixed head start before any timing gate starts to bite, ms. */
  graceMs: number;
  /** Extra allowance on one target's reaction window, ms. */
  reactionGraceMs: number;
  /** Units per wave (survival-waves, endless). */
  waveSize: number;
  /** Units between checkpoints (race-checkpoints). */
  unitsPerCheckpoint: number;
  /** Pursuer speed in expected-chars per second (escape-run). */
  chaserCharsPerSec: number;
  /** Chars of head start before the pursuer moves (escape-run). */
  headStartChars: number;
  /** Shield hit points (defense-shield). */
  shieldHits: number;
  /** Boss phases (boss-phased). */
  phases: number;
}

export interface MechanicRunInput {
  mechanic: RealMechanic;
  /** Code points of the server-known prompt. */
  expected: string[];
  /** Code points of the committed buffer. */
  typed: string[];
  /**
   * ms offset (from first keystroke) of each committed character — exactly
   * one entry per element of `typed`. Validated before use; see timeline.ts.
   */
  timeline: number[];
  units: MechanicUnit[];
  params: MechanicParams;
  caseSensitive: boolean;
}

export type MechanicEndReason =
  /** Reached the end of the prompt with the mechanic satisfied. */
  | "completed"
  /** Ran out of lives (falling-catch, survival-waves, endless, collection). */
  | "out-of-lives"
  /** Shield hit points exhausted (defense-shield). */
  | "shield-broken"
  /** The pursuer caught up (escape-run). */
  | "caught"
  /** A checkpoint time gate was missed (race-checkpoints). */
  | "checkpoint-missed"
  /** Time ran out with the boss still standing (boss-phased). */
  | "boss-survived"
  /** Stopped early without failing a rule (quit, timeout, partial run). */
  | "incomplete";

export interface MechanicEvent {
  /** ms offset from the first keystroke. */
  at: number;
  kind:
    | "unit-cleared"
    | "unit-missed"
    | "life-lost"
    | "wave-cleared"
    | "checkpoint"
    | "shield-hit"
    | "phase-cleared"
    | "chain-broken"
    | "ended";
  /** Unit index the event refers to, when it refers to one. */
  unit?: number;
}

export interface MechanicOutcome {
  mechanic: RealMechanic;
  /** Did the player satisfy the mechanic's own win condition? */
  cleared: boolean;
  endReason: MechanicEndReason;
  /**
   * Index into `typed` where the mechanic ended the run — `typed.length` when
   * it never failed. A client that keeps playing past a rule failure replays
   * to a smaller value here than it reported, which surfaces as a digest
   * mismatch.
   */
  endedAtChar: number;
  lives: { max: number; lost: number };
  units: { total: number; cleared: number; missed: number };
  /**
   * Per-mechanic numbers for the HUD and the result screen (boss HP left,
   * longest chain, waves survived, distance…). Display only — never an input
   * to scoring, so a new key here can never change what an attempt is worth.
   */
  detail: Record<string, number>;
  /** Ordered moments, for result-screen playback. Excluded from the digest. */
  events: MechanicEvent[];
}

/**
 * The comparable core of an outcome. Client and server must agree on exactly
 * these fields; `detail` and `events` are presentation and are left out so
 * that improving a HUD readout can never invalidate a legitimate attempt.
 */
export interface MechanicDigest {
  mechanic: RealMechanic;
  cleared: boolean;
  endReason: MechanicEndReason;
  livesLost: number;
  unitsCleared: number;
  unitsMissed: number;
  endedAtChar: number;
}

export function digestOf(outcome: MechanicOutcome): MechanicDigest {
  return {
    mechanic: outcome.mechanic,
    cleared: outcome.cleared,
    endReason: outcome.endReason,
    livesLost: outcome.lives.lost,
    unitsCleared: outcome.units.cleared,
    unitsMissed: outcome.units.missed,
    endedAtChar: outcome.endedAtChar,
  };
}

export function digestsMatch(a: MechanicDigest, b: MechanicDigest): boolean {
  return (
    a.mechanic === b.mechanic &&
    a.cleared === b.cleared &&
    a.endReason === b.endReason &&
    a.livesLost === b.livesLost &&
    a.unitsCleared === b.unitsCleared &&
    a.unitsMissed === b.unitsMissed &&
    a.endedAtChar === b.endedAtChar
  );
}
