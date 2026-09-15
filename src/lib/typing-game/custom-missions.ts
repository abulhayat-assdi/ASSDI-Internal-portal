/**
 * Custom (teacher-authored) mission presentation helpers. Pure: no
 * Supabase, no network — mirrors src/lib/typing-game/competitions.ts.
 */
import type {
  CompletionMode,
  CustomMissionStatus,
  LeaderboardMetric,
} from "@/lib/typing-game/server/custom-mission-store";

export type MissionStatusKey =
  | "missionStatusDraft"
  | "missionStatusActive"
  | "missionStatusArchived";

export function missionStatusKey(status: CustomMissionStatus): MissionStatusKey {
  switch (status) {
    case "active":
      return "missionStatusActive";
    case "archived":
      return "missionStatusArchived";
    default:
      return "missionStatusDraft";
  }
}

export type CompletionModeKey =
  | "completionOnce"
  | "completionTimed"
  | "completionRepetitions";

export function completionModeKey(mode: CompletionMode): CompletionModeKey {
  switch (mode) {
    case "timed":
      return "completionTimed";
    case "repetitions":
      return "completionRepetitions";
    default:
      return "completionOnce";
  }
}

export type LeaderboardMetricKey =
  | "metricFastestTime"
  | "metricHighestAccuracy"
  | "metricHighestWpm"
  | "metricMostRepetitions";

export function leaderboardMetricKey(metric: LeaderboardMetric): LeaderboardMetricKey {
  switch (metric) {
    case "highest_accuracy":
      return "metricHighestAccuracy";
    case "highest_wpm":
      return "metricHighestWpm";
    case "most_repetitions":
      return "metricMostRepetitions";
    default:
      return "metricFastestTime";
  }
}

/** mm:ss.d from milliseconds — best-time display for timed/fastest-time missions. */
export function formatElapsed(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  const totalMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const tenths = Math.floor((totalMs % 1000) / 100);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}.${String(tenths)}`;
}

/** Word/character count for the passage-length hint in the mission wizard. */
export function passageStats(text: string): { words: number; chars: number } {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return { words, chars: text.length };
}

/** Render a leaderboard row's metric value according to what the metric means. */
export function formatMetricValue(
  metric: LeaderboardMetric,
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (metric === "fastest_time") return formatElapsed(value);
  if (metric === "highest_accuracy") return `${String(Math.round(value))}%`;
  return String(Math.round(value));
}

/** Render a roster row's best-value cell for a given metric-relevant column. */
export function formatAccuracy(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${String(Math.round(value))}%`;
}

export function formatWpm(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}
