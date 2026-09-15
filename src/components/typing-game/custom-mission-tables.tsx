import { Crown } from "lucide-react";
import { Avatar, Badge, cx } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import {
  formatAccuracy,
  formatElapsed,
  formatMetricValue,
  formatWpm,
} from "@/lib/typing-game/custom-missions";
import type {
  CustomMissionLeaderboardRow,
  CustomMissionRosterRow,
  LeaderboardMetric,
} from "@/lib/typing-game/server/custom-mission-store";

/** Every active member of the mission's assigned batches, incl. zero-attempt students. */
export function CustomMissionRosterTable({
  locale,
  rows,
}: {
  locale: Locale;
  rows: CustomMissionRosterRow[];
}) {
  const t = getTranslator(locale, "missions");
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">{t("rosterEmpty")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="tap-table">
        <caption className="tap-sr-only">{t("detailsRoster")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("colStudent")}</th>
            <th scope="col">{t("colLevel")}</th>
            <th scope="col">{t("colGamesPlayed")}</th>
            <th scope="col">{t("colAttempts")}</th>
            <th scope="col">{t("colQualifying")}</th>
            <th scope="col">{t("colCompleted")}</th>
            <th scope="col">{t("colBestTime")}</th>
            <th scope="col">{t("colBestAccuracy")}</th>
            <th scope="col">{t("colBestWpm")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className={r.completed ? "tap-row-top" : undefined}>
              <th scope="row">
                <div className="flex items-center gap-2">
                  <Avatar name={r.fullName} size="sm" />
                  <span>
                    {r.fullName}{" "}
                    <span className="text-ink-faint">({r.rollNumber ?? "—"})</span>
                  </span>
                </div>
              </th>
              <td>{r.currentLevel}</td>
              <td>{r.gamesPlayed}</td>
              <td>{r.totalAttempts}</td>
              <td>{r.qualifyingAttempts}</td>
              <td>
                <Badge tone={r.completed ? "success" : "neutral"}>
                  {r.completed ? t("yes") : t("no")}
                </Badge>
              </td>
              <td>{formatElapsed(r.bestElapsedMs)}</td>
              <td>{formatAccuracy(r.bestAccuracy)}</td>
              <td>{formatWpm(r.bestWpm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Per-mission board ranked by the teacher-chosen metric. */
export function CustomMissionLeaderboardTable({
  locale,
  rows,
  metric,
}: {
  locale: Locale;
  rows: CustomMissionLeaderboardRow[];
  metric: LeaderboardMetric;
}) {
  const t = getTranslator(locale, "missions");
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">{t("leaderboardEmpty")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="tap-table">
        <caption className="tap-sr-only">{t("detailsLeaderboard")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("colRank")}</th>
            <th scope="col">{t("colStudent")}</th>
            <th scope="col">{t("colScore")}</th>
            <th scope="col">{t("colQualifying")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className={cx(r.rank <= 3 && "tap-row-top")}>
              <td>
                <span className="inline-flex items-center gap-1">
                  {r.rank === 1 ? (
                    <Crown
                      className="h-4 w-4"
                      style={{ color: "var(--tap-warning-500)" }}
                      aria-hidden="true"
                    />
                  ) : r.rank <= 3 ? (
                    <span aria-hidden="true">{r.rank === 2 ? "🥈" : "🥉"}</span>
                  ) : null}
                  {r.rank}
                </span>
              </td>
              <th scope="row">
                <div className="flex items-center gap-2">
                  <Avatar name={r.fullName} size="sm" />
                  <span>
                    {r.fullName}{" "}
                    <span className="text-ink-faint">({r.rollNumber ?? "—"})</span>
                  </span>
                </div>
              </th>
              <td>{formatMetricValue(metric, r.metricValue)}</td>
              <td>{r.qualifyingAttempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
