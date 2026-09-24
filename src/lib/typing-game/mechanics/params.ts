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

/** Difficulty multipliers: higher difficulty = less time, fewer lives. */
const TIME_SCALE: Record<Difficulty, number> = {
  beginner: 1.35,
  intermediate: 1,
  expert: 0.78,
};

const LIVES: Record<Difficulty, number> = {
  beginner: 5,
  intermediate: 3,
  expert: 2,
};

/**
 * Per-unit time budgets, ms, at intermediate difficulty. Chosen so a learner
 * typing ~20 WPM clears a beginner run and an ~45 WPM typist clears expert:
 * a 4-character word at 20 WPM takes ~1.2s, so 2600ms * 1.35 leaves real
 * headroom, while 2600 * 0.78 ≈ 2.0s demands steady pace.
 */
const BASE_FALL_MS = 2_600;
const BASE_SPAWN_MS = 1_900;

export function resolveParams(
  mechanic: RealMechanic,
  config: Record<string, unknown>,
  difficulty: Difficulty,
  unitCount: number,
): MechanicParams {
  const timeScale = TIME_SCALE[difficulty];
  const fallMs = Math.round(BASE_FALL_MS * timeScale);
  const spawnIntervalMs = Math.round(BASE_SPAWN_MS * timeScale);

  // A checkpoint every ~5 units keeps a 20-40 unit run to 4-8 gates.
  const unitsPerCheckpoint = Math.max(
    2,
    Math.min(6, Math.ceil(unitCount / 6) || 2),
  );

  return {
    lives: num(config, "lives") ?? LIVES[difficulty],
    spawnIntervalMs,
    fallMs,
    waveSize: num(config, "waveSize") ?? Math.max(3, Math.min(8, Math.ceil(unitCount / 5))),
    unitsPerCheckpoint,
    // Budget per checkpoint segment scales with how many units it spans.
    checkpointMs: Math.round(unitsPerCheckpoint * BASE_FALL_MS * timeScale),
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
