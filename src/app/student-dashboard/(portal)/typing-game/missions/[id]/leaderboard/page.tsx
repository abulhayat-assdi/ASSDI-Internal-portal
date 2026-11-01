import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, cx } from "@/components/typing-game/ui";
import { DEFAULT_LOCALE, getTranslator } from "@/lib/typing-game/i18n";
import { customMissionPageContext } from "@/lib/typing-game/server/custom-mission-pages";
import {
  formatMetricValue,
  missionLeaderboardMetricLabel,
} from "@/lib/typing-game/custom-mission-ui";

/**
 * Mission leaderboard: ranked per the mission's own leaderboardMetric.
 * metricValue's meaning is metric-dependent (fastest_time = ms, ascending
 * is better; the others are "higher is better") — formatMetricValue and
 * missionLeaderboardMetricLabel encode that, never assumed here.
 */
export default async function MissionLeaderboardPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const { session, store } = await customMissionPageContext(locale);

  const mission = await store.getAssigned(id);
  if (!mission) notFound();
  const rows = await store.getLeaderboard(id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mission.title}
        description={t("detailsLeaderboard")}
        actions={
          <Link
            href={`/student-dashboard/typing-game/missions/${mission.id}`}
            className="tap-btn tap-btn-secondary tap-btn-md"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("backToMissions")}
          </Link>
        }
      />

      <Badge tone="neutral">
        {missionLeaderboardMetricLabel(t, mission.leaderboardMetric)}
      </Badge>

      {rows.length === 0 ? (
        <EmptyState title={t("detailsLeaderboard")} description={t("leaderboardEmpty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="tap-table">
            <caption className="tap-sr-only">{mission.title}</caption>
            <thead>
              <tr>
                <th scope="col">{t("colRank")}</th>
                <th scope="col">{t("colStudent")}</th>
                <th scope="col">
                  {missionLeaderboardMetricLabel(t, mission.leaderboardMetric)}
                </th>
                <th scope="col">{t("colQualifying")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const me = row.userId === session.userId;
                return (
                  <tr
                    key={row.userId}
                    className={me ? "tap-row-me" : row.rank <= 3 ? "tap-row-top" : undefined}
                  >
                    <td>
                      <span className="inline-flex items-center gap-1">
                        {row.rank === 1 ? (
                          <Crown
                            className="h-4 w-4"
                            style={{ color: "var(--tap-warning-500)" }}
                            aria-hidden="true"
                          />
                        ) : row.rank <= 3 ? (
                          <span aria-hidden="true">{row.rank === 2 ? "🥈" : "🥉"}</span>
                        ) : null}
                        {row.rank}
                      </span>
                    </td>
                    <th scope="row">
                      <div className={cx("flex items-center gap-2")}>
                        <Avatar name={row.fullName} size="sm" />
                        <span>
                          {row.fullName}{" "}
                          {row.rollNumber ? (
                            <span className="text-ink-faint">({row.rollNumber})</span>
                          ) : null}
                        </span>
                        {me ? <Badge tone="primary">{t("youLabel")}</Badge> : null}
                      </div>
                    </th>
                    <td>{formatMetricValue(mission.leaderboardMetric, row.metricValue)}</td>
                    <td>{row.qualifyingAttempts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
