"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, CalendarRange, Sparkles } from "lucide-react";
import {
  MissionCard as UiMissionCard,
  ProgressBar,
  type BadgeTone,
} from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type { MissionInstance } from "@/lib/typing-game/server/mission-store";

export type MissionStatusKey =
  | "statusAvailable"
  | "statusActive"
  | "statusCompleted"
  | "statusLocked"
  | "statusExpired";

/** Translation key for a mission instance's status pill. */
export function missionStatusLabelKey(status: string): MissionStatusKey {
  switch (status) {
    case "completed":
      return "statusCompleted";
    case "active":
      return "statusActive";
    case "available":
      return "statusAvailable";
    case "locked":
      return "statusLocked";
    case "expired":
      return "statusExpired";
    default:
      return "statusAvailable";
  }
}

/** Badge tone for a mission instance's status pill. */
export function missionStatusTone(status: string): BadgeTone {
  switch (status) {
    case "completed":
      return "success";
    case "active":
      return "primary";
    case "expired":
      return "danger";
    case "locked":
      return "neutral";
    default:
      return "neutral";
  }
}

const PERIOD_ICON: Record<string, typeof CalendarCheck> = {
  daily: CalendarCheck,
  weekly: CalendarRange,
  event: Sparkles,
};

/** Student mission card: adventure framing, progress, reward, CTA. */
export function StudentMissionCard({
  locale,
  mission,
}: {
  locale: Locale;
  mission: MissionInstance;
}) {
  const t = getTranslator(locale, "missions");
  const done = mission.objectives.filter((o) => o.completed).length;
  const total = mission.objectives.length;
  const kind =
    mission.period === "daily"
      ? "daily"
      : mission.period === "weekly"
        ? "trial"
        : "event";
  const complete = mission.status === "completed";
  const cta = complete
    ? null
    : mission.status === "active"
      ? t("continueQuest")
      : t("startQuest");
  const Icon = PERIOD_ICON[mission.period] ?? CalendarCheck;

  return (
    <motion.div
      className="flex flex-col gap-2"
      initial={complete ? { opacity: 0, scale: 0.94 } : false}
      animate={complete ? { opacity: 1, scale: [0.94, 1.04, 1] } : { opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <UiMissionCard
        title={
          <Link
            href={`/student-dashboard/typing-game/missions/${mission.instanceId}`}
            className="inline-flex items-center gap-1.5"
          >
            <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--tap-primary-500)" }} aria-hidden="true" />
            {mission.title}
          </Link>
        }
        description={mission.description || undefined}
        kind={kind}
        kindLabel={t(missionStatusLabelKey(mission.status))}
        reward={t("rewardPreview", {
          xp: mission.rewardXp,
          coins: mission.rewardCoins,
        })}
        complete={complete}
        action={
          cta ? (
            <Link
              href={`/student-dashboard/typing-game/missions/${mission.instanceId}`}
              className="tap-btn tap-btn-primary tap-btn-sm"
            >
              {cta}
            </Link>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-1" aria-label={t("detailsObjectives")}>
        {mission.objectives.map((o) => (
          <ProgressBar
            key={o.position}
            value={o.current}
            max={Math.max(o.target, 1)}
            label={t("progressOf", { done: o.current, total: o.target })}
          />
        ))}
        {total > 1 ? (
          <p className="text-xs text-ink-muted">
            {t("progressOf", { done, total })}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
