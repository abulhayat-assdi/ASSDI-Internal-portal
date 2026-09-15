"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flame, Skull } from "lucide-react";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/**
 * Boss HP bar with phase marker. Color shifts green → amber → red as HP
 * drops, with a motion-safe pulse on low HP (disabled under
 * prefers-reduced-motion); never blocks interaction. `currentHp`/`maxHp`
 * arrive from the boss instance — this component never estimates damage.
 */
export function BossHpBar({
  locale,
  currentHp,
  maxHp,
  phaseName,
}: {
  locale: Locale;
  currentHp: number;
  maxHp: number;
  phaseName: string;
}) {
  const t = getTranslator(locale, "bosses");
  const reduceMotion = useReducedMotion();
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
  const defeated = pct <= 0;
  const low = pct <= 25 && !defeated;
  const fill = defeated
    ? "var(--tap-neutral-500)"
    : low
      ? "var(--tap-danger-grad)"
      : pct <= 60
        ? "var(--tap-warning-grad)"
        : "var(--tap-success-grad)";

  return (
    <div className="tap-boss-hp" role="group" aria-label={phaseName}>
      <div className="tap-boss-hp-top">
        <span className="tap-boss-hp-icon" aria-hidden="true">
          {defeated ? <Skull className="h-6 w-6" /> : <Flame className="h-6 w-6" />}
        </span>
        <div className="tap-boss-hp-body">
          <p className="tap-boss-hp-label">{t("bossHp", { current: currentHp, max: maxHp })}</p>
          <p className="tap-boss-hp-phase">{phaseName}</p>
        </div>
      </div>
      <div
        className={low ? "tap-boss-hp-track motion-safe:animate-pulse" : "tap-boss-hp-track"}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={phaseName}
      >
        <motion.div
          className="tap-boss-hp-fill"
          style={{ background: fill }}
          initial={false}
          animate={{ width: `${String(pct)}%` }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 18 }}
        />
      </div>
    </div>
  );
}
