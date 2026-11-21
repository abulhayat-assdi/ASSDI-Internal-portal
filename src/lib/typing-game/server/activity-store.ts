/**
 * Daily typing time and the student's daily goal (0049_ranks_reset_daily_goal.sql).
 * Days are Bangladesh calendar days.
 */
import type { PostgrestClient } from "@supabase/postgrest-js";

export const GOAL_CHOICES = [5, 10, 15, 20, 30, 45, 60] as const;
export const DEFAULT_GOAL = 15;

/** Today's date in Bangladesh (YYYY-MM-DD). */
export function bdToday(now = new Date()): string {
  return new Date(now.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}

export interface DailyGoalState {
  goalMinutes: number;
  todayMs: number;
  /** Last 7 days, oldest first: { day, ms }. */
  week: { day: string; ms: number }[];
}

export function createActivityStore(client: PostgrestClient) {
  return {
    /** Adds typing time to today. Best-effort: never throws. */
    async addTime(ms: number): Promise<void> {
      if (!Number.isFinite(ms) || ms <= 0) return;
      try {
        await client.rpc("fn_add_typing_time", { p_ms: Math.round(ms) });
      } catch {
        /* a missed minute must never break a lesson or test */
      }
    },
    async setGoal(minutes: number): Promise<void> {
      const res = await client.rpc("fn_set_daily_goal", { p_minutes: minutes });
      if (res.error) throw new Error(res.error.message);
    },
    async state(userId: string): Promise<DailyGoalState> {
      const today = bdToday();
      const since = bdToday(new Date(Date.now() - 6 * 86400000));
      const [settings, days] = await Promise.all([
        client.from("student_settings").select("daily_goal_minutes").eq("user_id", userId).maybeSingle(),
        client.from("daily_activity").select("day, typing_ms").eq("user_id", userId).gte("day", since),
      ]);
      const byDay = new Map<string, number>();
      for (const r of (days.data ?? []) as { day: string; typing_ms: number | string }[]) byDay.set(String(r.day), Number(r.typing_ms));
      const week = Array.from({ length: 7 }, (_, i) => {
        const day = bdToday(new Date(Date.now() - (6 - i) * 86400000));
        return { day, ms: byDay.get(day) ?? 0 };
      });
      const goal = Number((settings.data as { daily_goal_minutes?: number } | null)?.daily_goal_minutes ?? DEFAULT_GOAL);
      return { goalMinutes: goal, todayMs: byDay.get(today) ?? 0, week };
    },
  };
}
