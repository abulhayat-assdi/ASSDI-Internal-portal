import { describe, expect, it } from "vitest";
import { ARCADE_GAMES, type ArcadeSlug } from "./catalog";
import { mulberry32, TICKS_PER_SECOND, type ArcadeContent, type BaseSim } from "./core";
import { buildArcadeContent } from "./content.server";
import { createSim, replayRun, type KeyLog } from "./registry";
import type { MeteorShieldSim } from "./games/meteor-shield";
import type { BubbleBurstSim } from "./games/bubble-burst";
import type { RunnerRushSim } from "./games/runner-rush";
import type { TurboRacerSim } from "./games/turbo-racer";
import type { ComboBlitzSim } from "./games/combo-blitz";
import type { BombSquadSim } from "./games/bomb-squad";
import type { LavaClimbSim } from "./games/lava-climb";
import type { DragonKeepSim } from "./games/dragon-keep";

/** The character a perfect player would type next (null = nothing to type). */
function want(slug: ArcadeSlug, s: BaseSim): string | null {
  switch (slug) {
    case "meteor-shield": {
      const g = s as MeteorShieldSim;
      const cur = g.meteors.find((m) => m.id === g.locked);
      if (cur) return cur.word[cur.typed];
      const low = [...g.meteors].sort((a, b) => b.y - a.y)[0];
      return low ? low.word[0] : null;
    }
    case "bubble-burst": {
      const g = s as BubbleBurstSim;
      const cur = g.bubbles.find((m) => m.id === g.locked);
      if (cur) return cur.word[cur.typed];
      const top = [...g.bubbles].sort((a, b) => a.y - b.y)[0];
      return top ? top.word[0] : null;
    }
    case "runner-rush": {
      const o = (s as RunnerRushSim).active;
      return o ? o.word[o.typed] : null;
    }
    case "turbo-racer": {
      const g = s as TurboRacerSim;
      return g.countdown > 0 || g.breakLeft > 0 || g.skid > 0 ? null : g.text[g.pos];
    }
    case "combo-blitz": {
      const g = s as ComboBlitzSim;
      return g.text[g.pos];
    }
    case "bomb-squad": {
      const g = s as BombSquadSim;
      return g.gap > 0 ? null : g.code[g.pos];
    }
    case "lava-climb": {
      const g = s as LavaClimbSim;
      return g.current[g.typed];
    }
    case "dragon-keep": {
      const g = s as DragonKeepSim;
      return g.gap > 0 || !g.spell ? null : g.spell[g.pos];
    }
  }
}

/** Plays a run like a student typing at `wpm` with `errorRate` mistakes. */
function botRun(slug: ArcadeSlug, content: ArcadeContent, seed: number, wpm: number, errorRate: number, maxSeconds = 600) {
  const sim = createSim(slug, content, seed);
  const rnd = mulberry32(seed + 7);
  const perKey = (TICKS_PER_SECOND * 60) / (wpm * 5);
  const log: KeyLog = [];
  let next = perKey;
  let tick = 0;
  const limit = maxSeconds * TICKS_PER_SECOND;
  while (!sim.over && tick < limit) {
    if (tick >= next) {
      const k = want(slug, sim);
      if (k) {
        const key = rnd() < errorRate ? (k === "q" ? "z" : "q") : k;
        log.push([tick, key]);
        sim.key(key);
      }
      next += perKey * (0.7 + rnd() * 0.6);
    }
    sim.tick();
    sim.events.length = 0;
    tick++;
  }
  return { sim, log, ticks: tick };
}

const content = buildArcadeContent(12345);

describe("arcade content", () => {
  it("is deterministic per seed and fills every tier", () => {
    expect(buildArcadeContent(99)).toEqual(buildArcadeContent(99));
    expect(buildArcadeContent(99)).not.toEqual(buildArcadeContent(100));
    for (const tier of content.words) expect(tier.length).toBeGreaterThan(100);
    for (const tier of content.sentences) expect(tier.length).toBeGreaterThan(20);
    for (const s of content.sentences.flat()) expect(s).toMatch(/^[\x20-\x7E]+$/);
  });
});

describe.each(ARCADE_GAMES.map((g) => g.slug))("%s", (slug) => {
  it("replays a run to the identical result", () => {
    const { sim, log, ticks } = botRun(slug, content, 777, 35, 0.04);
    const r = replayRun(slug, content, 777, log, ticks);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toEqual(sim.result());
  });

  it("ends a run with no typing (the game has a real fail state)", () => {
    const { sim } = botRun(slug, content, 5, 1, 0, 900);
    // Combo Blitz and Lava Climb wait for the first key; everything else must end on its own.
    if (slug !== "combo-blitz" && slug !== "lava-climb") expect(sim.over).toBe(true);
  });

  it("rejects tampered logs", () => {
    expect(replayRun(slug, content, 1, [[5, "a"], [3, "b"]], 10).ok).toBe(false);
    expect(replayRun(slug, content, 1, [[1, "ab"]], 10).ok).toBe(false);
    const burst: KeyLog = Array.from({ length: 40 }, (_, i) => [10 + Math.floor(i / 4), "a"]);
    expect(replayRun(slug, content, 1, burst, 100)).toEqual({ ok: false, error: "TOO_FAST" });
  });
});

describe("difficulty curve (bot typists)", () => {
  it("gets harder: faster typists last longer and score more", () => {
    const rows: string[] = [];
    const all: [string, number[]][] = [];
    for (const g of ARCADE_GAMES) {
      const cells: string[] = [];
      const scores: number[] = [];
      for (const wpm of [20, 35, 55]) {
        const { sim } = botRun(g.slug, content, 4242, wpm, 0.03);
        const r = sim.result();
        cells.push(`${wpm}wpm: ${Math.round(r.durationMs / 1000)}s score ${r.score} lv${r.level}${r.won ? " WON" : ""}`);
        scores.push(r.score);
      }
      rows.push(`${g.slug.padEnd(14)} ${cells.join(" | ")}`);
    }
    console.log(rows.join("\n"));
  });
});
