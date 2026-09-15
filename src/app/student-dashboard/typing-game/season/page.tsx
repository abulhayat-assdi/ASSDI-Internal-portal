import Link from "next/link";
import { Gift, Trophy, Users } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionHeader,
  StatCard,
} from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { seasonPageContext } from "@/lib/typing-game/server/season-pages";
import { SeasonBoard, seasonStatusKey, seasonStatusTone } from "@/components/typing-game/season-board";
import { CompetitionCountdown } from "@/components/typing-game/competition-countdown";

/** Season hub: banner, countdown, my progress, boards, history. */
export default async function SeasonHubPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "seasons");
  const { session, store } = await seasonPageContext(locale);
  const seasons = await store.listSeasons();
  const active =
    seasons.find((s) => s.status === "active") ??
    seasons.find((s) => s.status === "processing") ??
    null;
  if (!active) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("hubTitle")} description={t("hubSubtitle")} />
        <EmptyState title={t("hubTitle")} description={t("noActiveSeason")} />
        {seasons.length > 0 ? (
          <Card>
            <CardContent>
              <SectionHeader title={t("sectionHistory")} />
              <div className="flex flex-col gap-2">
                {seasons.map((s) => (
                  <Link
                    key={s.id}
                    href={`/student-dashboard/typing-game/season/${s.id}`}
                    className="tap-card tap-card-interactive flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="font-semibold">{s.name}</span>
                    <Badge tone={seasonStatusTone(s.status)}>{t(seasonStatusKey(s.status))}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }
  const detail = await store.getSeason(active.id, session.userId);
  if (!detail) {
    return (
      <EmptyState title={t("hubTitle")} description={t("noActiveSeason")} />
    );
  }
  const serverNow = new Date().toISOString();
  const history = seasons.filter((s) => s.id !== active.id);

  const startMs = Date.parse(detail.startAt);
  const endMs = Date.parse(detail.endAt);
  const elapsedPct =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? Math.min(100, Math.max(0, ((Date.now() - startMs) / (endMs - startMs)) * 100))
      : null;

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
          {detail.status === "active" ? (
            <>
              {elapsedPct !== null ? (
                <div className="flex flex-col gap-1">
                  <ProgressBar
                    value={elapsedPct}
                    max={100}
                    label={t("seasonProgressPct", { pct: Math.round(elapsedPct) })}
                  />
                  <p className="text-xs text-ink-muted">
                    {t("seasonProgressPct", { pct: Math.round(elapsedPct) })}
                  </p>
                </div>
              ) : null}
              <CompetitionCountdown
                serverNowIso={serverNow}
                targetIso={detail.endAt}
                label={t("timeLeft", { time: "" }).replace(/:\s*$/, "")}
              />
              <p className="mt-1 text-xs text-ink-muted">{t("serverTimeNote")}</p>
            </>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Link
              href={`/student-dashboard/typing-game/season/leaderboard`}
              className="tap-btn tap-btn-secondary tap-btn-sm"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              {t("sectionStudentBoard")}
            </Link>
            <Link
              href={`/student-dashboard/typing-game/season/rewards`}
              className="tap-btn tap-btn-secondary tap-btn-sm"
            >
              <Gift className="h-4 w-4" aria-hidden="true" />
              {t("sectionRewards")}
            </Link>
          </div>
        </CardContent>
      </Card>

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
      {history.length > 0 ? (
        <Card>
          <CardContent>
            <SectionHeader title={t("sectionHistory")} />
            <div className="flex flex-col gap-2">
              {history.map((s) => (
                <Link
                  key={s.id}
                  href={`/student-dashboard/typing-game/season/${s.id}`}
                  className="tap-card tap-card-interactive flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="font-semibold">{s.name}</span>
                  <Badge tone={seasonStatusTone(s.status)}>{t(seasonStatusKey(s.status))}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {detail.status === "finalized" ? (
        <p className="text-sm text-ink-muted">{t("finalNote")}</p>
      ) : null}
    </div>
  );
}
