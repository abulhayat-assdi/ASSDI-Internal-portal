/**
 * Lesson progress persistence. Reads go through RLS as the student;
 * writes only through the SECURITY DEFINER functions in
 * 0046_lesson_progress.sql.
 */
import type { PostgrestClient } from "@supabase/postgrest-js";
import type { LessonProgressRow, LessonStatus } from "@/lib/typing-game/curriculum/progress";

export interface RecordLessonInput {
  lessonId: string;
  levelId: string;
  wpm: number;
  accuracy: number;
  stars: number;
  elapsedMs: number;
}

export interface LessonStore {
  listProgress(userId: string): Promise<Map<string, LessonProgressRow>>;
  record(input: RecordLessonInput): Promise<{ xp: number; firstCompletion: boolean }>;
  skip(lessonIds: string[], levelId: string): Promise<number>;
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0);

export function createLessonStore(client: PostgrestClient): LessonStore {
  return {
    async listProgress(userId) {
      const res = await client
        .from("lesson_progress")
        .select("lesson_id, status, stars, best_wpm, best_accuracy, best_time_ms, attempts")
        .eq("user_id", userId);
      if (res.error) throw new Error(res.error.message);
      const map = new Map<string, LessonProgressRow>();
      for (const r of (res.data ?? []) as Record<string, unknown>[]) {
        map.set(String(r.lesson_id), {
          lessonId: String(r.lesson_id),
          status: r.status as LessonStatus,
          stars: num(r.stars),
          bestWpm: num(r.best_wpm),
          bestAccuracy: num(r.best_accuracy),
          bestTimeMs: r.best_time_ms == null ? null : num(r.best_time_ms),
          attempts: num(r.attempts),
        });
      }
      return map;
    },
    async record(input) {
      const res = await client.rpc("fn_record_lesson_result", {
        p_lesson_id: input.lessonId,
        p_level_id: input.levelId,
        p_wpm: input.wpm,
        p_accuracy: input.accuracy,
        p_stars: input.stars,
        p_time_ms: Math.round(input.elapsedMs),
      });
      if (res.error) throw new Error(res.error.message);
      const d = (res.data ?? {}) as Record<string, unknown>;
      return { xp: num(d.xp), firstCompletion: d.first_completion === true };
    },
    async skip(lessonIds, levelId) {
      if (lessonIds.length === 0) return 0;
      const res = await client.rpc("fn_skip_lessons", { p_lesson_ids: lessonIds, p_level_id: levelId });
      if (res.error) throw new Error(res.error.message);
      return num(res.data);
    },
  };
}
