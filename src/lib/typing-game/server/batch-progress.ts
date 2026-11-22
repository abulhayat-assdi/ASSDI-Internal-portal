/**
 * Lesson / test / daily-time overview for a teacher's batch. Reads go
 * through RLS (0050: teachers see students of batches they teach).
 */
import type { PostgrestClient } from "@supabase/postgrest-js";
import { LEVELS } from "@/lib/typing-game/curriculum";
import { levelLessons } from "@/lib/typing-game/curriculum/progress";
import { bdToday } from "./activity-store";

export interface LessonCell {
  status: "completed" | "skipped";
  stars: number;
  bestWpm: number;
}

export interface StudentProgressRow {
  userId: string;
  perLesson: Record<string, LessonCell>;
  /** levelId -> { completed, total, avgStars } */
  perLevel: Record<string, { completed: number; total: number; avgStars: number }>;
  bestOneMinuteWpm: number | null;
  todayMinutes: number;
  weekMinutes: number;
}

export async function loadBatchProgress(client: PostgrestClient, userIds: string[]): Promise<Map<string, StudentProgressRow>> {
  const out = new Map<string, StudentProgressRow>();
  if (userIds.length === 0) return out;
  const since = bdToday(new Date(Date.now() - 6 * 86400000));
  const today = bdToday();
  const [lessons, tests, days] = await Promise.all([
    client.from("lesson_progress").select("user_id, lesson_id, status, stars, best_wpm").in("user_id", userIds),
    client.from("typing_test_sessions").select("user_id, test_id, wpm").in("user_id", userIds).eq("status", "graded").eq("test_id", "time-1"),
    client.from("daily_activity").select("user_id, day, typing_ms").in("user_id", userIds).gte("day", since),
  ]);

  for (const id of userIds) {
    out.set(id, { userId: id, perLesson: {}, perLevel: {}, bestOneMinuteWpm: null, todayMinutes: 0, weekMinutes: 0 });
  }
  for (const r of (lessons.data ?? []) as Record<string, unknown>[]) {
    const row = out.get(String(r.user_id));
    if (!row) continue;
    row.perLesson[String(r.lesson_id)] = {
      status: r.status === "skipped" ? "skipped" : "completed",
      stars: Number(r.stars ?? 0),
      bestWpm: Number(r.best_wpm ?? 0),
    };
  }
  for (const r of (tests.data ?? []) as Record<string, unknown>[]) {
    const row = out.get(String(r.user_id));
    const wpm = Number(r.wpm ?? 0);
    if (row && (row.bestOneMinuteWpm === null || wpm > row.bestOneMinuteWpm)) row.bestOneMinuteWpm = wpm;
  }
  for (const r of (days.data ?? []) as Record<string, unknown>[]) {
    const row = out.get(String(r.user_id));
    if (!row) continue;
    const min = Math.floor(Number(r.typing_ms ?? 0) / 60000);
    row.weekMinutes += min;
    if (String(r.day) === today) row.todayMinutes += min;
  }
  for (const row of out.values()) {
    for (const level of LEVELS) {
      const all = levelLessons(level);
      const done = all.map((l) => row.perLesson[l.id]).filter((c): c is LessonCell => c?.status === "completed");
      row.perLevel[level.id] = {
        completed: done.length,
        total: all.length,
        avgStars: done.length ? done.reduce((n, c) => n + c.stars, 0) / done.length : 0,
      };
    }
  }
  return out;
}
