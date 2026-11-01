import { notFound } from "next/navigation";
import { Alert, Badge, RewardCard, PageHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { seasonPageContext } from "@/lib/typing-game/server/season-pages";
import { seasonStatusKey, seasonStatusTone } from "@/components/typing-game/season-board";

/** Season rewards view: tier ladder and final-note framing. */
export default async function SeasonRewardsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "seasons");
  const { session, store } = await seasonPageContext(locale);
  const seasons = await store.listSeasons();
  const active = seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
  if (!active) notFound();
  const detail = await store.getSeason(active.id, session.userId);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("sectionRewards")}
        description={detail.name}
        actions={
          <Badge tone={seasonStatusTone(detail.status)}>
            {t(seasonStatusKey(detail.status))}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <RewardCard title={t("rewardFirst")} art="🥇" />
        <RewardCard title={t("rewardSecond")} art="🥈" />
        <RewardCard title={t("rewardThird")} art="🥉" />
      </div>
      <RewardCard title={t("rewardParticipation")} art="🎁" />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t("colTier")} value={detail.myTier ?? "—"} />
        <StatCard label={t("colPoints")} value={detail.myPoints} />
      </div>

      {detail.status === "finalized" ? (
        <Alert tone="info" title={t("sectionRewards")}>
          {t("finalNote")}
        </Alert>
      ) : null}
    </div>
  );
}
