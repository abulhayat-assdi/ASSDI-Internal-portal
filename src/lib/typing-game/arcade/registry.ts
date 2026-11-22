/**
 * Game factory and the replay used by the server to compute a run's result
 * from its key log. The browser drives the very same `createSim` objects
 * with the very same order (keys of a tick first, then the tick).
 */
import { TICK_MS, type ArcadeContent, type ArcadeResult, type BaseSim } from "./core";
import type { ArcadeSlug } from "./catalog";
import { MeteorShieldSim } from "./games/meteor-shield";
import { BubbleBurstSim } from "./games/bubble-burst";
import { RunnerRushSim } from "./games/runner-rush";
import { TurboRacerSim } from "./games/turbo-racer";
import { ComboBlitzSim } from "./games/combo-blitz";
import { BombSquadSim } from "./games/bomb-squad";
import { LavaClimbSim } from "./games/lava-climb";
import { DragonKeepSim } from "./games/dragon-keep";

export function createSim(slug: ArcadeSlug, content: ArcadeContent, seed: number): BaseSim {
  switch (slug) {
    case "meteor-shield":
      return new MeteorShieldSim(content, seed);
    case "bubble-burst":
      return new BubbleBurstSim(content, seed);
    case "runner-rush":
      return new RunnerRushSim(content, seed);
    case "turbo-racer":
      return new TurboRacerSim(content, seed);
    case "combo-blitz":
      return new ComboBlitzSim(content, seed);
    case "bomb-squad":
      return new BombSquadSim(content, seed);
    case "lava-climb":
      return new LavaClimbSim(content, seed);
    case "dragon-keep":
      return new DragonKeepSim(content, seed);
  }
}

/** [tick, key] — the key was applied at the start of that tick. */
export type KeyLog = [number, string][];

/** Longest run the server will replay (30 minutes of game time). */
export const MAX_TICKS = (30 * 60 * 1000) / TICK_MS;
/** Most keys a run may carry (~ 300 wpm for 30 minutes). */
export const MAX_KEYS = 50000;

export type ReplayCheck =
  | { ok: true; result: ArcadeResult; ticks: number }
  | { ok: false; error: string };

/**
 * Replays a run. `endTick` is how many ticks the browser ran. The log must
 * be in tick order, every key a single printable character, and no key may
 * come after the run ended.
 */
export function replayRun(slug: ArcadeSlug, content: ArcadeContent, seed: number, log: KeyLog, endTick: number): ReplayCheck {
  if (!Number.isInteger(endTick) || endTick < 0 || endTick > MAX_TICKS) return { ok: false, error: "BAD_TICKS" };
  if (!Array.isArray(log) || log.length > MAX_KEYS) return { ok: false, error: "BAD_LOG" };
  let prev = 0;
  for (const e of log) {
    if (!Array.isArray(e) || e.length !== 2) return { ok: false, error: "BAD_LOG" };
    const [t, k] = e;
    if (!Number.isInteger(t) || t < prev || t > endTick) return { ok: false, error: "BAD_LOG" };
    if (typeof k !== "string" || Array.from(k).length !== 1 || k < " ") return { ok: false, error: "BAD_LOG" };
    prev = t;
  }
  if (!rateOk(log)) return { ok: false, error: "TOO_FAST" };

  const sim = createSim(slug, content, seed);
  let i = 0;
  let tick = 0;
  for (; tick < endTick && !sim.over; tick++) {
    while (i < log.length && log[i][0] === tick) sim.key(log[i++][1]);
    sim.tick();
    sim.events.length = 0;
  }
  // Keys on the final tick (the one that ended the run) were applied before it.
  return { ok: true, result: sim.result(), ticks: tick };
}

/** No human sustains more than ~25 keys in any one second. */
function rateOk(log: KeyLog): boolean {
  const window = 1000 / TICK_MS;
  let lo = 0;
  for (let hi = 0; hi < log.length; hi++) {
    while (log[hi][0] - log[lo][0] >= window) lo++;
    if (hi - lo + 1 > 25) return false;
  }
  return true;
}
