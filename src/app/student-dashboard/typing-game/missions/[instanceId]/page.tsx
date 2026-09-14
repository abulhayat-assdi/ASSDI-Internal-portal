import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, PageHeader, ProgressBar } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { missionPageContext } from "@/lib/typing-game/server/mission-pages";
import { MissionStartButton } from "@/components/typing-game/mission-actions";
import { MissionRewardMoment } from "@/components/typing-game/mission-widgets";

/**
 * Mission details: objectives with progress, reward preview, start CTA,
 * completion moment. All values server-derived; start/sync via the API.
 */
export default async function MissionDetailPage(
  props: {
    params: Promise<{ locale: string; instanceId: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const { store } = await missionPageContext(locale);
  const mission = await store.getInstance(params.instanceId);
  if (!mission) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mission.title}
        description={mission.description || t("hubSubtitle")}
      />

      {mission.status === "completed" ? (
        <MissionRewardMoment locale={locale} mission={mission} />
      ) : null}

      <Card>
        <CardContent>
          <h2 className="mb-2 text-base font-bold">{t("detailsObjectives")}</h2>
          <div className="flex flex-col gap-2">
            {mission.objectives.map((o) => (
              <ProgressBar
                key={o.position}
                value={o.current}
                max={Math.max(o.target, 1)}
                label={`${o.kind}: ${t("progressOf", { done: o.current, total: o.target })}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="mb-2 text-base font-bold">{t("detailsReward")}</h2>
          <p className="text-sm">
            {t("rewardPreview", {
              xp: mission.rewardXp,
              coins: mission.rewardCoins,
            })}
          </p>
          <h2 className="mb-2 mt-4 text-base font-bold">{t("detailsHow")}</h2>
          <p className="text-sm text-ink-muted">{t("detailsHowBody")}</p>
        </CardContent>
      </Card>

      {mission.status === "available" ? (
        <MissionStartButton locale={locale} instanceId={mission.instanceId} />
      ) : null}
      {mission.status === "active" ? (
        <Link
          href={`/student-dashboard/typing-game/games`}
          className="tap-btn tap-btn-primary"
        >
          {t("playToProgress")}
        </Link>
      ) : null}
    </div>
  );
}
