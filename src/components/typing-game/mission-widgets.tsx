import Link from "next/link";
import { ScrollText, Target } from "lucide-react";
import { Badge, Card, CardContent, RewardCard } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type { MissionInstance } from "@/lib/typing-game/server/mission-store";
import type { CustomMission } from "@/lib/typing-game/server/custom-mission-store";
import { missionRuleSummary } from "@/lib/typing-game/custom-mission-ui";

/**
 * Completion moment: reward reveal with motion-safe animation only
 * (no motion when the OS requests reduced motion). Issuance stays
 * server-side; this is presentation of an already-awarded mission.
 */
export function MissionRewardMoment({
  locale,
  mission,
}: {
  locale: Locale;
  mission: MissionInstance;
}) {
  const t = getTranslator(locale, "missions");
  return (
    <div className="motion-safe:animate-[mission-pop_600ms_ease-out]">
      <RewardCard
        title={t("completedTitle")}
        description={t("completedBody")}
        amount={t("rewardPreview", {
          xp: mission.rewardXp,
          coins: mission.rewardCoins,
        })}
        claimed
        claimedLabel={t("statusCompleted")}
      />
    </div>
  );
}

/**
 * Dashboard widget: up to 3 active custom missions the student hasn't
 * completed yet (caller filters/caps the list — see dashboard/page.tsx).
 * Replaces the old daily/weekly auto-mission widget.
 */
export function MissionWidgets({
  locale,
  missions,
}: {
  locale: Locale;
  missions: CustomMission[];
}) {
  const t = getTranslator(locale, "missions");
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-bold">
            <Target className="h-4 w-4 text-primary-500" aria-hidden="true" />
            {t("widgetTitle")}
          </h2>
          <Link
            href={`/student-dashboard/typing-game/missions`}
            className="tap-btn tap-btn-secondary tap-btn-sm"
          >
            {t("widgetViewAll")}
          </Link>
        </div>
        {missions.length === 0 ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
            <ScrollText className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("widgetEmpty")}
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {missions.slice(0, 3).map((m) => (
              <Link
                key={m.id}
                href={`/student-dashboard/typing-game/missions/${m.id}`}
                className="tap-mission"
              >
                <div className="tap-mission-top">
                  <h3 className="tap-mission-title">{m.title}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{missionRuleSummary(t, m)}</Badge>
                  <span className="text-xs text-ink-muted">
                    {t("rewardSummary", { xp: m.rewardXp, coins: m.rewardCoins })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
