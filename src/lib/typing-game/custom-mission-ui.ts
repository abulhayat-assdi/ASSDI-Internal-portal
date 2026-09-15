/**
 * Small presentation helpers shared by the student custom-mission pages
 * (list / detail / play / leaderboard / dashboard widget) so the completion
 * rule summary and leaderboard metric formatting stay consistent instead of
 * being re-derived ad hoc in each page. Pure functions only — no data
 * fetching, no invented numbers (every value comes from the caller).
 */
import type {
  CompletionMode,
  CustomMission,
  LeaderboardMetric,
} from "@/lib/typing-game/server/custom-mission-store";
import type { Messages, Vars } from "@/lib/typing-game/i18n";

export type MissionsTranslator = (
  key: keyof Messages["missions"] & string,
  vars?: Vars,
) => string;

/** Plain-language completion rule, e.g. "Finish once" / "Within 60s" / "3 repetitions". */
export function missionRuleSummary(
  t: MissionsTranslator,
  mission: Pick<CustomMission, "completionMode" | "timeLimitSeconds" | "repetitionsTarget">,
): string {
  const mode: CompletionMode = mission.completionMode;
  switch (mode) {
    case "once":
      return t("ruleOnceSummary");
    case "timed":
      return t("ruleTimedSummary", { seconds: mission.timeLimitSeconds ?? 0 });
    case "repetitions":
      return t("ruleRepsSummary", { count: mission.repetitionsTarget ?? 0 });
    default:
      return "";
  }
}

/** Label for a mission's leaderboard ranking metric. */
export function missionLeaderboardMetricLabel(
  t: MissionsTranslator,
  metric: LeaderboardMetric,
): string {
  switch (metric) {
    case "fastest_time":
      return t("metricFastestTime");
    case "highest_accuracy":
      return t("metricHighestAccuracy");
    case "highest_wpm":
      return t("metricHighestWpm");
    case "most_repetitions":
      return t("metricMostRepetitions");
    default:
      return "";
  }
}

/**
 * Formats a leaderboard row's metricValue per the mission's own metric
 * definition (never assume "higher/lower is better" — that's metric-specific,
 * per custom-mission-store.ts's documented contract).
 */
export function formatMetricValue(
  metric: LeaderboardMetric,
  value: number | null,
): string {
  if (value === null) return "—";
  switch (metric) {
    case "fastest_time": {
      const totalSeconds = Math.max(0, Math.round(value / 1000));
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${String(m)}:${String(s).padStart(2, "0")}`;
    }
    case "highest_accuracy":
      return `${String(Math.round(value))}%`;
    case "highest_wpm":
      return `${String(Math.round(value))} WPM`;
    case "most_repetitions":
      return String(Math.round(value));
    default:
      return String(value);
  }
}
