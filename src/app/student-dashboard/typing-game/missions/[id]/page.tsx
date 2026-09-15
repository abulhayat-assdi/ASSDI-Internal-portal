import Link from "next/link";
import { notFound } from "next/navigation";
import { Coins, Target, Trophy, Zap } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  PageHeader,
  SectionHeader,
  StatCard,
} from "@/components/typing-game/ui";
import { DEFAULT_LOCALE, getTranslator } from "@/lib/typing-game/i18n";
import { customMissionPageContext } from "@/lib/typing-game/server/custom-mission-pages";
import { missionRuleSummary } from "@/lib/typing-game/custom-mission-ui";
import { StartCustomMissionButton } from "@/components/typing-game/custom-mission-actions";

const PASSAGE_PREVIEW_LENGTH = 220;

/**
 * Mission detail: passage preview, completion rule + gates in plain
 * language, reward, and either a Start button or a completed state linking
 * to the leaderboard. The mission is terminal once completed for
 * once/timed modes; repetitions missions stay startable until the target
 * repetition count is reached (enforced server-side by the start endpoint).
 */
export default async function MissionDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const { session, store } = await customMissionPageContext(locale);

  const mission = await store.getAssigned(id);
  if (!mission) notFound();
  const myCompletion = await store.getMyCompletion(mission.id, session.userId);

  const passagePreview =
    mission.passageText.length > PASSAGE_PREVIEW_LENGTH
      ? `${mission.passageText.slice(0, PASSAGE_PREVIEW_LENGTH).trimEnd()}…`
      : mission.passageText;

  const hasGates = mission.minAccuracy !== null || mission.minWpm !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mission.title}
        description={mission.description || undefined}
        actions={
          myCompletion ? <Badge tone="success">{t("statusCompleted")}</Badge> : undefined
        }
      />

      <Card>
        <CardContent>
          <SectionHeader title={t("detailsPassage")} />
          <p className="whitespace-pre-wrap font-mono text-sm text-ink-muted">
            {passagePreview}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title={t("detailsRule")} />
          <Badge tone="primary">{missionRuleSummary(t, mission)}</Badge>

          {hasGates ? (
            <>
              <SectionHeader title={t("requirementsTitle")} className="mt-4" />
              <div className="flex flex-col gap-2">
                {mission.minAccuracy !== null ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t("minAccuracySummary", { value: mission.minAccuracy })}
                  </div>
                ) : null}
                {mission.minWpm !== null ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t("minWpmSummary", { value: mission.minWpm })}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title={t("detailsReward")} />
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t("fieldWinnerXp")}
              value={`+${String(mission.rewardXp)}`}
              icon={<Zap className="h-4 w-4" aria-hidden="true" />}
            />
            <StatCard
              label={t("fieldRewardCoins")}
              value={`+${String(mission.rewardCoins)}`}
              icon={<Coins className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
        </CardContent>
      </Card>

      {myCompletion ? (
        <Card>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold">{t("completedTitle")}</p>
                <p className="text-sm text-ink-muted">{t("completedBody")}</p>
              </div>
              <Link
                href={`/student-dashboard/typing-game/missions/${mission.id}/leaderboard`}
                className="tap-btn tap-btn-primary tap-btn-md"
              >
                <Trophy className="h-4 w-4" aria-hidden="true" />
                {t("viewLeaderboard")}
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <StartCustomMissionButton locale={locale} missionId={mission.id} />
          <Link
            href={`/student-dashboard/typing-game/missions/${mission.id}/leaderboard`}
            className="tap-btn tap-btn-secondary tap-btn-md"
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            {t("viewLeaderboard")}
          </Link>
        </div>
      )}
    </div>
  );
}
