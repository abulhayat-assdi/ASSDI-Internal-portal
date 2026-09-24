/**
 * Guards the claim that every shipped game is actually playable: each one
 * either runs a real mechanic end-to-end or is a known shell mechanic.
 * Runs against the live catalog, so adding a game that nothing can play
 * fails here rather than in front of a student.
 */
import { describe, expect, it } from "vitest";
import { GAMES, buildPrompt } from "@/lib/typing-game/content";
import {
  REAL_MECHANICS,
  asDifficulty,
  isRealMechanic,
  resolveParams,
  runMechanic,
  segmentUnits,
} from "./index";

const SHELL_MECHANICS = ["time-trial", "accuracy-trial", "duel-rounds", "relay-team"];

/** A flawless run at a brisk-but-human 55 WPM (~55ms per character). */
function perfectRun(expectedText: string, mechanic: string, difficulty: string) {
  const expected = Array.from(expectedText);
  const units = segmentUnits(expectedText);
  return runMechanic({
    mechanic: mechanic as (typeof REAL_MECHANICS)[number],
    expected,
    typed: expected,
    timeline: expected.map((_, i) => (i + 1) * 55),
    units,
    params: resolveParams(
      mechanic as (typeof REAL_MECHANICS)[number],
      {},
      asDifficulty(difficulty),
      units.length,
    ),
    caseSensitive: true,
  });
}

describe("catalog playability", () => {
  it("covers every mechanic used by the catalog", () => {
    const used = new Set(GAMES.map((g) => g.mechanic));
    const known = new Set<string>([...REAL_MECHANICS, ...SHELL_MECHANICS]);
    for (const m of used) expect(known.has(m)).toBe(true);
  });

  it("gives the real mechanics to the games that should have them", () => {
    const real = GAMES.filter((g) => isRealMechanic(g.mechanic));
    // 27 of the 38 shipped games run real rules; the rest are shell games.
    expect(real.length).toBe(GAMES.length - GAMES.filter((g) => SHELL_MECHANICS.includes(g.mechanic)).length);
    expect(real.length).toBeGreaterThan(0);
  });

  it.each(GAMES.filter((g) => isRealMechanic(g.mechanic)).map((g) => [g.slug, g] as const))(
    "%s: a flawless run clears the mechanic",
    (_slug, game) => {
      const prompt = buildPrompt(
        game.promptSource.ref,
        game.promptSource.units,
        `playability-${game.slug}`,
      );
      const out = perfectRun(prompt.text, game.mechanic, game.difficulty);

      // A perfect, brisk run must never end in a failure state — if it does,
      // the mechanic's parameters are unwinnable for that game's content.
      expect(out.endReason).toBe("completed");
      expect(out.cleared).toBe(true);
      expect(out.units.missed).toBe(0);
    },
  );

  it.each(GAMES.filter((g) => isRealMechanic(g.mechanic)).map((g) => [g.slug, g] as const))(
    "%s: a run that gets everything wrong never counts as a clear",
    (_slug, game) => {
      const prompt = buildPrompt(
        game.promptSource.ref,
        game.promptSource.units,
        `sloppy-${game.slug}`,
      );
      const expected = Array.from(prompt.text);
      // Every non-space character wrong, typed at a crawl. Whatever the
      // mechanic, this must not be reported as a cleared run — otherwise a
      // student could "win" without typing anything correctly.
      const typed = expected.map((c) => (c === " " ? c : "\u0000"));
      const units = segmentUnits(prompt.text);
      const out = runMechanic({
        mechanic: game.mechanic as (typeof REAL_MECHANICS)[number],
        expected,
        typed,
        timeline: expected.map((_, i) => (i + 1) * 900),
        units,
        params: resolveParams(
          game.mechanic as (typeof REAL_MECHANICS)[number],
          {},
          asDifficulty(game.difficulty),
          units.length,
        ),
        caseSensitive: true,
      });
      expect(out.cleared).toBe(false);
      expect(out.units.cleared).toBe(0);
    },
  );
});
