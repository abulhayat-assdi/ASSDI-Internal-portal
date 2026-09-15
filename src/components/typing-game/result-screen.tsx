"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion, type Variants } from "framer-motion";
import { Award, Flame, Sparkles, Star, Trophy } from "lucide-react";
import {
  AchievementBadge,
  Badge,
  Card,
  CardContent,
  ProgressRing,
  StatCard,
} from "@/components/typing-game/ui";
import type { SubmitSnapshot, ValidatedResult } from "./game-player";

export interface ResultStrings {
  title: string;
  subtitle: string;
  wpm: string;
  accuracy: string;
  score: string;
  duration: string;
  errors: string;
  corrected: string;
  personalBest: string;
  xpEarned: string;
  coinsEarned: string;
  levelUp: string;
  badgeEarned: string;
  streakKept: string;
  unlocked: string;
  playAgain: string;
  backToMap: string;
  continueAdventure: string;
  rejectedTitle: string;
  rejectedDescription: string;
  expiredTitle: string;
  expiredDescription: string;
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 26 },
  },
};

/**
 * Animates the on-screen digits from 0 up to `value`. Purely a rendering
 * convergence effect — it always settles on the exact server-supplied
 * number, never a different or estimated one.
 */
function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    setDisplay(0);
    const controls = animate(0, value, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (latest: number) => { setDisplay(Math.round(latest)); },
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return <>{display}</>;
}

/**
 * Server-truth result screen. Every reward number arrives from the submit
 * response; run stats (duration/errors) are client-measured context only.
 * The celebratory motion (stagger reveal, count-up, PB/level-up glow) is
 * purely presentational and never alters or estimates a value.
 */
export function ResultScreen({
  result,
  snap,
  isPB,
  strings: s,
  gameHref,
  mapHref,
  dashboardHref,
  recoveryHref,
  recoveryLabel,
  visual,
}: {
  result: ValidatedResult;
  snap: SubmitSnapshot | null;
  isPB: boolean;
  strings: ResultStrings;
  gameHref: string;
  mapHref: string;
  dashboardHref: string;
  /**
   * Optional rewarded-recovery path (M17). The ordinary retry link
   * always renders; the ad path is an extra, never the only route.
   */
  recoveryHref?: string | null;
  recoveryLabel?: string | null;
  /** Game's theme.visual — reskins the hero accent via the shared CSS. */
  visual?: string;
}) {
  const p = result.progression;
  const seconds = snap ? Math.max(0, Math.round(snap.elapsedMs / 1000)) : null;
  const reduceMotion = useReducedMotion();
  const leveledUp = Boolean(p?.leveledUp);
  const HeroIcon = leveledUp ? Star : isPB ? Trophy : Award;

  return (
    <motion.div
      data-visual={visual}
      variants={reduceMotion ? undefined : containerVariants}
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      className="mx-auto flex w-full max-w-2xl flex-col gap-5"
    >
      <motion.div
        variants={reduceMotion ? undefined : itemVariants}
        className="flex flex-col items-center gap-2 text-center"
      >
        <motion.div
          initial={reduceMotion ? undefined : { scale: 0.5, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
          style={{ background: "var(--tap-primary-grad)" }}
        >
          <HeroIcon className="h-8 w-8 text-white" strokeWidth={1.75} />
        </motion.div>
        <h1 className="font-display text-3xl font-extrabold">{s.title}</h1>
        <p className="text-ink-muted">{s.subtitle}</p>
        {isPB ? (
          <motion.div
            animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Badge tone="legendary">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              {s.personalBest}
            </Badge>
          </motion.div>
        ) : null}
      </motion.div>

      <motion.div
        variants={reduceMotion ? undefined : itemVariants}
        className="flex items-center justify-center gap-8"
      >
        <div className="tap-mech-ring-wrap">
          <ProgressRing value={result.accuracy} max={100} size={92} label={s.accuracy} />
          <div className="tap-mech-ring-value">
            <span className="text-xl font-extrabold">
              <CountUp value={Math.round(result.accuracy)} />%
            </span>
            <span className="text-[0.6rem] uppercase tracking-wide text-ink-faint">
              {s.accuracy}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span
            className="text-5xl font-extrabold tabular-nums"
            style={{
              backgroundImage: "var(--tap-primary-grad)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            <CountUp value={Math.round(result.effectiveWpm)} />
          </span>
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            {s.wpm}
          </span>
        </div>
      </motion.div>

      <motion.div variants={reduceMotion ? undefined : itemVariants} className="grid grid-cols-3 gap-3">
        <StatCard label={s.wpm} value={Math.round(result.effectiveWpm)} />
        <StatCard
          label={s.accuracy}
          value={`${String(Math.round(result.accuracy))}%`}
        />
        <StatCard label={s.score} value={Math.round(result.score)} />
      </motion.div>
      {snap ? (
        <motion.div variants={reduceMotion ? undefined : itemVariants} className="grid grid-cols-3 gap-3">
          <StatCard label={s.duration} value={`${String(seconds)}s`} />
          <StatCard label={s.errors} value={snap.incorrectChars} />
          <StatCard label={s.corrected} value={snap.corrections} />
        </motion.div>
      ) : null}

      {p ? (
        <motion.div variants={reduceMotion ? undefined : itemVariants}>
          <Card className={leveledUp ? "tap-result-glow" : undefined}>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">
                  {s.xpEarned.replace("{xp}", String(p.xp))}
                </Badge>
                {p.coins > 0 ? (
                  <Badge tone="warning">
                    {s.coinsEarned.replace("{coins}", String(p.coins))}
                  </Badge>
                ) : null}
                {leveledUp ? (
                  <motion.span
                    animate={reduceMotion ? undefined : { scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Badge tone="legendary">
                      <Flame className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                      {s.levelUp.replace("{level}", String(p.level))}
                    </Badge>
                  </motion.span>
                ) : null}
                {p.streakCurrent > 0 ? (
                  <Badge tone="success">{s.streakKept}</Badge>
                ) : null}
              </div>
              {p.newBadges.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-bold">{s.badgeEarned}</p>
                  <motion.div
                    variants={reduceMotion ? undefined : containerVariants}
                    initial={reduceMotion ? undefined : "hidden"}
                    animate={reduceMotion ? undefined : "show"}
                    className="flex flex-wrap gap-3"
                  >
                    {p.newBadges.map((b) => (
                      <motion.div key={b.slug} variants={reduceMotion ? undefined : itemVariants}>
                        <AchievementBadge name={b.name} rarity="legendary" earned />
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              ) : null}
              {p.unlocked.length > 0 ? (
                <p className="mt-3 text-sm">
                  {s.unlocked}: {p.unlocked.length}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <motion.div
        variants={reduceMotion ? undefined : itemVariants}
        className="flex flex-wrap justify-center gap-2"
      >
        <Link href={gameHref} className="tap-btn tap-btn-secondary tap-btn-md">
          {s.playAgain}
        </Link>
        {recoveryHref && recoveryLabel ? (
          <Link
            href={recoveryHref}
            className="tap-btn tap-btn-secondary tap-btn-md"
          >
            {recoveryLabel}
          </Link>
        ) : null}
        <Link href={mapHref} className="tap-btn tap-btn-secondary tap-btn-md">
          {s.backToMap}
        </Link>
        <Link
          href={dashboardHref}
          className="tap-btn tap-btn-primary tap-btn-md"
        >
          {s.continueAdventure}
        </Link>
      </motion.div>
    </motion.div>
  );
}
