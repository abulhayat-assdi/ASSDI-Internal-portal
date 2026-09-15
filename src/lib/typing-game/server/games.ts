/**
 * Game catalog composition (M6). Merges DB operational state with the
 * @tap/content copy catalog; evaluates unlocks with the M5 TS evaluator over
 * server-assembled stats (same function family the SQL cache mirrors —
 * verdicts here explain, the game_unlocks rows authorize).
 */
import { GAMES, WORLDS, ALWAYS_FREE_GAME_SLUGS, AD_UNLOCKABLE_GAME_SLUGS } from "@/lib/typing-game/content";
import { evaluateUnlock, type UnlockStats } from "@/lib/typing-game/progression";
import type { StudentStore } from "./student-store";
import {
  filterGames,
  sortGames,
  type EnrichedGame,
  type GameFilter,
  type GameSort,
} from "@/lib/typing-game/game-catalog";

export type { EnrichedGame, GameFilter, GameSort };
export { filterGames, sortGames };

export interface WorldMapEntry {
  slug: string;
  order: number;
  nameEn: string;
  nameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  status: "complete" | "current" | "open" | "locked";
  total: number;
  completed: number;
  unlocked: number;
  nextGameSlug: string | null;
  games: EnrichedGame[];
}

async function playerStats(
  userId: string,
  store: StudentStore,
): Promise<UnlockStats> {
  const [profile, agg, completed, awards] = await Promise.all([
    store.getProfile(userId),
    store.aggregateResults(userId),
    store.listCompletedGames(userId),
    store.listAwards(userId),
  ]);
  return {
    level: profile?.level ?? 1,
    totalXp: profile?.xpTotal ?? 0,
    bestAccuracy: agg.bestAccuracy,
    bestWpm: agg.bestWpm,
    completedMissions: 0,
    completedGames: completed,
    badges: awards.map((a) => a.badgeSlug),
    worldsCompleted: [],
  };
}

export async function enrichGames(
  userId: string,
  store: StudentStore,
): Promise<EnrichedGame[]> {
  // Unlock verdicts are computed fresh via evaluateUnlock (same rule family
  // the SQL cache mirrors); the game_unlocks cache itself is only a shortcut
  // for the two overrides below (manual ad-unlocks) — it does not drive the
  // normal rule-based verdict.
  const [rows, completed, records, manualUnlocks] = await Promise.all([
    store.listGames(),
    store.listCompletedGames(userId),
    store.listRecords(userId),
    store.listUnlocks(userId),
  ]);
  const done = new Set(completed);
  const manual = new Set(manualUnlocks);
  const best = new Map<string, number>();
  for (const r of records) {
    if (r.metric === "best_score") best.set(r.gameSlug, r.value);
  }
  const stats = await playerStats(userId, store);
  const defs = new Map(GAMES.map((g) => [g.slug, g]));

  const raw: EnrichedGame[] = rows.flatMap((row) => {
    const def = defs.get(row.slug);
    if (!def) return [];
    const verdict = evaluateUnlock(stats, def.unlockRule);
    return [
      {
        ...row,
        titleEn: def.title.en,
        titleBn: def.title.bn ?? "",
        descriptionEn: def.description.en,
        unlocked: verdict.unlocked,
        lockedReasons: verdict.missing,
        completed: done.has(row.slug),
        bestScore: best.get(row.slug) ?? null,
        adUnlockAvailable: false,
        sequenceUnlocked: verdict.unlocked,
      },
    ];
  });

  // Sequential world gate: a world only opens once the PREVIOUS world (by
  // `order`) is fully complete, layered on top of each game's own rule
  // verdict above rather than editing the 38 games' stored unlockRule.
  // World completeness is computed from the raw (pre-override) list so a
  // world already finished before this gate existed doesn't get penalized.
  const totalsByWorld = new Map<string, { total: number; completed: number }>();
  for (const g of raw) {
    const e = totalsByWorld.get(g.worldSlug) ?? { total: 0, completed: 0 };
    e.total += 1;
    if (g.completed) e.completed += 1;
    totalsByWorld.set(g.worldSlug, e);
  }
  const orderedWorlds = [...WORLDS].sort((a, b) => a.order - b.order);
  const worldOpenForSequence = new Map<string, boolean>();
  let previousComplete = true;
  for (const w of orderedWorlds) {
    worldOpenForSequence.set(w.slug, previousComplete);
    const totals = totalsByWorld.get(w.slug);
    previousComplete = !!totals && totals.total > 0 && totals.completed === totals.total;
  }

  for (const g of raw) {
    if (worldOpenForSequence.get(g.worldSlug) === false) {
      const prev = orderedWorlds[orderedWorlds.findIndex((w) => w.slug === g.worldSlug) - 1];
      g.unlocked = false;
      g.lockedReasons = prev
        ? [`Complete ${prev.name.en} first`, ...g.lockedReasons]
        : g.lockedReasons;
    }
    // Snapshot BEFORE the curated free/ad-unlock exceptions below — this is
    // what getWorldMapData uses to decide a world's own status, so one
    // always-free bonus game deep in a later world can't make that whole
    // world (and its "Next" CTA) appear reachable ahead of the sequence.
    // The final `unlocked` (after the exceptions) stays the one flag every
    // other consumer (Game Library, attempt start) uses to gate actually
    // playing a game.
    g.sequenceUnlocked = g.unlocked;
  }

  // Curated exceptions, applied last so they can override either the
  // original rule or the sequential gate above.
  for (const g of raw) {
    if (ALWAYS_FREE_GAME_SLUGS.includes(g.slug)) {
      g.unlocked = true;
      g.lockedReasons = [];
      continue;
    }
    if (!g.unlocked && AD_UNLOCKABLE_GAME_SLUGS.includes(g.slug)) {
      if (manual.has(g.slug)) {
        g.unlocked = true;
        g.lockedReasons = [];
      } else {
        g.adUnlockAvailable = true;
      }
    }
  }

  return raw;
}

export async function getWorldMapData(
  userId: string,
  store: StudentStore,
  recommendedSlug: string | null,
): Promise<WorldMapEntry[]> {
  const games = await enrichGames(userId, store);
  const byWorld = new Map<string, EnrichedGame[]>();
  for (const g of games) {
    const list = byWorld.get(g.worldSlug) ?? [];
    list.push(g);
    byWorld.set(g.worldSlug, list);
  }
  return WORLDS.map((w) => {
    const list = byWorld.get(w.slug) ?? [];
    const completed = list.filter((g) => g.completed).length;
    // World status is driven by sequenceUnlocked, not the final `unlocked`
    // — a curated always-free game elsewhere shouldn't make an entire later
    // world look reachable before the student has actually gotten there.
    const unlocked = list.filter((g) => g.sequenceUnlocked).length;
    const next =
      list.find((g) => g.slug === recommendedSlug && g.sequenceUnlocked) ??
      list.find((g) => g.sequenceUnlocked && !g.completed) ??
      null;
    const status: WorldMapEntry["status"] =
      list.length > 0 && completed === list.length
        ? "complete"
        : next
          ? "current"
          : unlocked > 0
            ? "open"
            : "locked";
    return {
      slug: w.slug,
      order: w.order,
      nameEn: w.name.en,
      nameBn: w.name.bn,
      descriptionEn: w.description.en,
      descriptionBn: w.description.bn,
      status,
      total: list.length,
      completed,
      unlocked,
      nextGameSlug: next?.slug ?? null,
      games: list,
    };
  });
}

export interface GameDetails extends EnrichedGame {
  promptUnits: number;
  scoringProfile: string;
  competitionEligible: boolean;
  version: number;
}

export async function getGameDetails(
  userId: string,
  slug: string,
  store: StudentStore,
): Promise<GameDetails | null> {
  const games = await enrichGames(userId, store);
  const found = games.find((g) => g.slug === slug);
  if (!found) return null;
  const defs = new Map(GAMES.map((g) => [g.slug, g]));
  const def = defs.get(slug);
  if (!def) return null;
  return {
    ...found,
    promptUnits: def.promptSource.units,
    scoringProfile: def.scoringProfile,
    competitionEligible: def.competitionEligible,
    version: def.version,
  };
}
