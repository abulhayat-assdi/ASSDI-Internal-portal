"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Gamepad2, Lock, Search, Sparkles, Trophy } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, LockedGameCard, cx } from "@/components/typing-game/ui";
import { AdUnlockButton, type AdUnlockStrings } from "@/components/typing-game/ad-unlock-button";
import { type Locale } from "@/lib/typing-game/i18n";
import { GAMES } from "@/lib/typing-game/content";
import { worldVisual } from "@/lib/typing-game/world-visuals";
import {
  filterGames,
  sortGames,
  type EnrichedGame,
  type GameSort,
} from "@/lib/typing-game/game-catalog";

export interface ExplorerStrings extends AdUnlockStrings {
  search: string;
  searchPlaceholder: string;
  filterWorld: string;
  filterDifficulty: string;
  filterMode: string;
  filterStatus: string;
  statusAll: string;
  statusUnlocked: string;
  statusLocked: string;
  statusCompleted: string;
  sortBy: string;
  sortRecommended: string;
  sortEasiest: string;
  sortBest: string;
  noResults: string;
  play: string;
  lockedReason: string;
  bestScore: string;
  beginner: string;
  intermediate: string;
  expert: string;
  viewDetails: string;
}

/** Per-game accent (falls back to the parent world's accent when unset). */
const GAME_VISUAL = new Map(GAMES.map((g) => [g.slug, g.theme.visual]));
function gameVisual(g: EnrichedGame): string {
  return GAME_VISUAL.get(g.slug) ?? worldVisual(g.worldSlug);
}

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

/** Client-side explorer: filter/sort/search over server-fetched catalog. */
export function GamesExplorer({
  locale,
  games,
  worlds,
  modes,
  recommendedSlug,
  strings: s,
}: {
  locale: Locale;
  games: EnrichedGame[];
  worlds: Array<{ slug: string; name: string }>;
  modes: string[];
  recommendedSlug: string | null;
  strings: ExplorerStrings;
}) {
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState<"all" | "unlocked" | "locked" | "completed">("all");
  const [sort, setSort] = useState<GameSort>("recommended");

  const visible = useMemo(
    () =>
      sortGames(
        filterGames(games, { query, world, difficulty, mode, status }),
        sort,
        recommendedSlug,
      ),
    [games, query, world, difficulty, mode, status, sort, recommendedSlug],
  );

  const diffLabel = (d: string): string =>
    d === "beginner" ? s.beginner : d === "intermediate" ? s.intermediate : s.expert;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{s.search}</span>
          <span className="tap-input-wrap">
            <Search className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); }}
              placeholder={s.searchPlaceholder}
              className="tap-input"
              aria-label={s.search}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{s.filterWorld}</span>
          <select
            value={world}
            onChange={(e) => { setWorld(e.target.value); }}
            className="tap-input-wrap tap-input"
          >
            <option value="">{s.statusAll}</option>
            {worlds.map((w) => (
              <option key={w.slug} value={w.slug}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{s.filterDifficulty}</span>
          <select
            value={difficulty}
            onChange={(e) => { setDifficulty(e.target.value); }}
            className="tap-input-wrap tap-input"
          >
            <option value="">{s.statusAll}</option>
            {["beginner", "intermediate", "expert"].map((d) => (
              <option key={d} value={d}>
                {diffLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{s.filterMode}</span>
          <select
            value={mode}
            onChange={(e) => { setMode(e.target.value); }}
            className="tap-input-wrap tap-input"
          >
            <option value="">{s.statusAll}</option>
            {modes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{s.filterStatus}</span>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); }
            }
            className="tap-input-wrap tap-input"
          >
            <option value="all">{s.statusAll}</option>
            <option value="unlocked">{s.statusUnlocked}</option>
            <option value="locked">{s.statusLocked}</option>
            <option value="completed">{s.statusCompleted}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{s.sortBy}</span>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as GameSort); }}
            className="tap-input-wrap tap-input"
          >
            <option value="recommended">{s.sortRecommended}</option>
            <option value="easiest">{s.sortEasiest}</option>
            <option value="best">{s.sortBest}</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={s.noResults} icon={<Gamepad2 className="h-8 w-8" />} />
      ) : (
        <motion.ul
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((g) => {
            const recommended = g.slug === recommendedSlug;
            const title = locale === "bn" && g.titleBn ? g.titleBn : g.titleEn;

            if (!g.unlocked) {
              return (
                <motion.li key={g.slug} variants={cardVariants}>
                  <div data-visual={gameVisual(g)}>
                    <LockedGameCard
                      title={title}
                      preview={
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ background: "linear-gradient(135deg, var(--tap-accent-from), var(--tap-accent-to))" }}
                        >
                          <Gamepad2 className="tap-world-icon h-7 w-7" strokeWidth={2} />
                        </div>
                      }
                      whyLocked={
                        g.lockedReasons.length > 0 ? g.lockedReasons : [s.lockedReason]
                      }
                      action={
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{diffLabel(g.difficulty)}</Badge>
                          <Badge tone="neutral">{g.mode}</Badge>
                          <Link
                            href={`/student-dashboard/typing-game/games/${g.slug}`}
                            className="tap-btn tap-btn-secondary tap-btn-sm ml-auto"
                          >
                            <Lock className="h-3.5 w-3.5" /> {s.viewDetails}
                          </Link>
                          {g.adUnlockAvailable ? (
                            <AdUnlockButton slug={g.slug} strings={s} />
                          ) : null}
                        </div>
                      }
                    />
                  </div>
                </motion.li>
              );
            }

            return (
              <motion.li key={g.slug} variants={cardVariants}>
                <div data-visual={gameVisual(g)}>
                  <Card interactive className={cx(recommended && "tap-card-recommended")}>
                    <CardContent>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="tap-game-glyph tap-game-glyph-sm" aria-hidden="true">
                            <Gamepad2 className="h-4 w-4" />
                          </span>
                          <h3 className="font-bold leading-tight">{title}</h3>
                        </div>
                        {recommended ? (
                          <Badge tone="primary">
                            <Sparkles className="h-3 w-3" /> {s.sortRecommended}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mb-3 text-sm text-ink-muted">{g.descriptionEn}</p>
                      <div className="mb-3 flex flex-wrap gap-1">
                        <Badge tone="neutral">{diffLabel(g.difficulty)}</Badge>
                        <Badge tone="neutral">{g.mode}</Badge>
                        {g.completed ? (
                          <Badge tone="success">{s.statusCompleted}</Badge>
                        ) : null}
                        {g.bestScore !== null ? (
                          <Badge tone="warning">
                            <Trophy className="h-3 w-3" /> {s.bestScore}: {g.bestScore}
                          </Badge>
                        ) : null}
                      </div>
                      <Link
                        href={`/student-dashboard/typing-game/games/${g.slug}`}
                        className="tap-btn tap-btn-primary tap-btn-sm"
                      >
                        {s.play}
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
