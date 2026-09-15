import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { Badge, Card, CardContent, PageHeader, SectionHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { seasonPageContext } from "@/lib/typing-game/server/season-pages";
import { SeasonBoard, seasonStatusKey, seasonStatusTone } from "@/components/typing-game/season-board";
import { CompetitionCountdown } from "@/components/typing-game/competition-countdown";

/** Season detail / history view (works for active and finalized). */
export default async function SeasonDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "seasons");
  const { session, store } = await seasonPageContext(locale);
  const detail = await store.getSeason(params.id, session.userId);
  if (!detail) notFound();
  const serverNow = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={detail.name}
        description={detail.theme}
        actions={
          <Badge tone={seasonStatusTone(detail.status)}>
            {t(seasonStatusKey(detail.status))}
          </Badge>
        }
      />
      {detail.status === "active" ? (
        <>
          <CompetitionCountdown
            serverNowIso={serverNow}
            targetIso={detail.endAt}
            label={t("timeLeft", { time: "" }).replace(/:\s*$/, "")}
          />
          <p className="text-xs text-ink-muted">{t("serverTimeNote")}</p>
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label={t("colPoints")}
          value={detail.myPoints}
          icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={t("colRank")}
          value={detail.myRank === null ? "—" : `#${detail.myRank}`}
        />
        <StatCard label={t("colTier")} value={detail.myTier ?? "—"} />
      </div>

      <Card>
        <CardContent>
          <SectionHeader title={t("sectionStudentBoard")} />
          <SeasonBoard locale={locale} rows={detail.studentBoard} clan={false} meId={session.userId} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("sectionClanBoard")} />
          <SeasonBoard locale={locale} rows={detail.clanBoard} clan={true} />
        </CardContent>
      </Card>
      {detail.status === "finalized" ? (
        <p className="text-sm text-ink-muted">{t("finalNote")}</p>
      ) : null}
    </div>
  );
}
