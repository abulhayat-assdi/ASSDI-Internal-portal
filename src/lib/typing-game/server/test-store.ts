/**
 * Typing test sessions. Reads through RLS as the student; writes only via
 * fn_start_typing_test / fn_finish_typing_test (0047_typing_tests.sql).
 */
import type { PostgrestClient } from "@supabase/postgrest-js";

export interface TestSessionRow {
  id: string;
  testId: string;
  language: "en" | "bn";
  text: string;
  durationS: number;
  status: "started" | "graded";
  startedAt: string;
  gradedAt: string | null;
  wpm: number | null;
  rawWpm: number | null;
  accuracy: number | null;
  correctChars: number | null;
  totalChars: number | null;
  timeMs: number | null;
}

export interface FinishInput {
  sessionId: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctChars: number;
  totalChars: number;
  timeMs: number;
  finishReason: string;
}

const num = (v: unknown) => (v == null ? null : Number(v));

function toRow(r: Record<string, unknown>): TestSessionRow {
  return {
    id: String(r.id),
    testId: String(r.test_id),
    language: r.language === "bn" ? "bn" : "en",
    text: String(r.text ?? ""),
    durationS: Number(r.duration_s),
    status: r.status === "graded" ? "graded" : "started",
    startedAt: String(r.started_at),
    gradedAt: r.graded_at ? String(r.graded_at) : null,
    wpm: num(r.wpm),
    rawWpm: num(r.raw_wpm),
    accuracy: num(r.accuracy),
    correctChars: num(r.correct_chars),
    totalChars: num(r.total_chars),
    timeMs: num(r.time_ms),
  };
}

export function createTestStore(client: PostgrestClient) {
  return {
    async start(testId: string, language: string, text: string, durationS: number): Promise<string> {
      const res = await client.rpc("fn_start_typing_test", {
        p_test_id: testId,
        p_language: language,
        p_text: text,
        p_duration_s: durationS,
      });
      if (res.error) throw new Error(res.error.message);
      return String(res.data);
    },
    async get(sessionId: string): Promise<TestSessionRow | null> {
      const res = await client.from("typing_test_sessions").select("*").eq("id", sessionId).maybeSingle();
      if (res.error) throw new Error(res.error.message);
      return res.data ? toRow(res.data as Record<string, unknown>) : null;
    },
    async finish(input: FinishInput): Promise<{ xp: number }> {
      const res = await client.rpc("fn_finish_typing_test", {
        p_session: input.sessionId,
        p_wpm: input.wpm,
        p_raw_wpm: input.rawWpm,
        p_accuracy: input.accuracy,
        p_correct_chars: input.correctChars,
        p_total_chars: input.totalChars,
        p_time_ms: input.timeMs,
        p_finish_reason: input.finishReason,
      });
      if (res.error) throw new Error(res.error.message);
      return { xp: Number((res.data as { xp?: unknown })?.xp ?? 0) };
    },
    /** Graded results, newest first (no text — it can be long). */
    async history(userId: string, limit = 50): Promise<TestSessionRow[]> {
      const res = await client
        .from("typing_test_sessions")
        .select("id, test_id, language, duration_s, status, started_at, graded_at, wpm, raw_wpm, accuracy, correct_chars, total_chars, time_ms")
        .eq("user_id", userId)
        .eq("status", "graded")
        .order("graded_at", { ascending: false })
        .limit(limit);
      if (res.error) throw new Error(res.error.message);
      return ((res.data ?? []) as Record<string, unknown>[]).map(toRow);
    },
  };
}

export type TestStore = ReturnType<typeof createTestStore>;
