/**
 * Resolving gameplay numbers from a game definition.
 *
 * The catalog's `config` already carries authored values for some mechanics
 * (`phases`, `shieldHits`, `targetsPerRound`, `sequenceLength`) that until
 * now nothing read. Those are honoured; everything else falls back to a
 * difficulty-scaled default so all 27 mechanic games are playable without
 * re-authoring the catalog.
 *
 * Both the browser and the route handler call this with the same
 * (config, difficulty, unitCount), so both sides resolve identical numbers —
 * the replay would be meaningless otherwise.
 */
import type { Difficulty } from "@/lib/typing-game/game-engine";
import type { MechanicParams, RealMechanic } from "./types";

function num(config: Record<string, unknown>, key: string): number | null {
  const v = config[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

const LIVES: Record<Difficulty, number> = {
  beginner: 5,
  intermediate: 3,
  expert: 2,
};

/**
 * The pace each difficulty is timed against, in expected characters per
 * second. 1.6 c/s is ~19 WPM, 2.6 is ~31 WPM, 3.6 is ~43 WPM — a floor a
 * learner at that band should clear, not a target they must hit, since lives
 * absorb a few late units on top.
 */
const TARGET_CPS: Record<Difficulty, number> = {
  beginner: 1.6,
  intermediate: 2.6,
  expert: 3.6,
};

/** Head start before any timing gate bites, ms — covers reading and settling. */
const GRACE_MS: Record<Difficulty, number> = {
  beginner: 2_500,
  intermediate: 2_000,
  expert: 1_500,
};

/** Extra allowance on a single target's reaction window, ms. */
const REACTION_GRACE_MS: Record<Difficulty, number> = {
  beginner: 900,
  intermediate: 600,
  expert: 400,
};

export function resolveParams(
  mechanic: RealMechanic,
  config: Record<string, unknown>,
  difficulty: Difficulty,
  unitCount: number,
): MechanicParams {
  // A checkpoint every ~5 units keeps a 20-40 unit run to 4-8 gates.
  const unitsPerCheckpoint = Math.max(
    2,
    Math.min(6, Math.ceil(unitCount / 6) || 2),
  );

  return {
    lives: num(config, "lives") ?? LIVES[difficulty],
    targetCharsPerSec: TARGET_CPS[difficulty],
    graceMs: GRACE_MS[difficulty],
    reactionGraceMs: REACTION_GRACE_MS[difficulty],
    waveSize: num(config, "waveSize") ?? Math.max(3, Math.min(8, Math.ceil(unitCount / 5))),
    unitsPerCheckpoint,
    chaserCharsPerSec: CHASER_SPEED[difficulty],
    headStartChars: num(config, "headStartChars") ?? HEAD_START[difficulty],
    shieldHits: num(config, "shieldHits") ?? SHIELD[difficulty],
    phases: num(config, "phases") ?? 3,
  };
}

/**
 * Pursuer speed in expected-characters per second. 4 c/s ≈ 48 WPM, so an
 * expert escape-run demands genuine pace while a beginner one (2 c/s ≈ 24
 * WPM) is survivable for a learner.
 */
const CHASER_SPEED: Record<Difficulty, number> = {
  beginner: 2,
  intermediate: 3,
  expert: 4,
};

const HEAD_START: Record<Difficulty, number> = {
  beginner: 24,
  intermediate: 16,
  expert: 10,
};

const SHIELD: Record<Difficulty, number> = {
  beginner: 5,
  intermediate: 3,
  expert: 2,
};

export function asDifficulty(value: string): Difficulty {
  return value === "intermediate" || value === "expert" ? value : "beginner";
}
