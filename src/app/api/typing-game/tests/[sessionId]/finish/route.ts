/**
 * POST /api/typing-game/tests/:sessionId/finish  (ExamWirePayload)
 * Re-grades the typed text against the text stored at start, bounded by
 * the server's own clock, and saves the result once.
 */
import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";
import { createTestStore } from "@/lib/typing-game/server/test-store";
import { createActivityStore } from "@/lib/typing-game/server/activity-store";
import { gradeSnapshot, parseClientSnapshot, readJsonBody } from "@/lib/typing-exam/session";

const NO_THRESHOLDS = { passWpm: 0, passAccuracy: 0, failWpm: 0, failAccuracy: 0 };
/** Above the fastest recorded sustained typing; anything higher is not typed by hand. */
const MAX_HUMAN_WPM = 250;

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const { sessionId } = await params;
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const store = createTestStore(client);
  try {
    const row = await store.get(sessionId);
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (row.status === "graded") return NextResponse.json({ error: "ALREADY_FINISHED" }, { status: 409 });

    const snapshot = parseClientSnapshot(await readJsonBody(req), row.text);
    if (!snapshot) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

    const graded = gradeSnapshot({
      examText: row.text,
      durationMs: row.durationS * 1000,
      thresholds: NO_THRESHOLDS,
      snapshot,
      serverElapsedMs: Date.now() - Date.parse(row.startedAt),
      fallbackReason: "TIME_UP",
    });
    // Pasted or scripted text graded over a few server seconds would show an
    // impossible speed; no human sustains this, so the result is refused.
    if (graded.score.wpm > MAX_HUMAN_WPM) return NextResponse.json({ error: "TOO_FAST" }, { status: 422 });

    const { xp } = await store.finish({
      sessionId,
      wpm: graded.score.wpm,
      rawWpm: graded.score.rawWpm,
      accuracy: graded.score.accuracy,
      correctChars: graded.score.correctChars,
      totalChars: graded.score.totalChars,
      timeMs: Math.round(graded.timeMs),
      finishReason: graded.reason,
    });
    await createActivityStore(client).addTime(graded.timeMs);
    return NextResponse.json({
      sessionId,
      wpm: graded.score.wpm,
      rawWpm: graded.score.rawWpm,
      accuracy: graded.score.accuracy,
      correctChars: graded.score.correctChars,
      totalChars: graded.score.totalChars,
      timeMs: Math.round(graded.timeMs),
      finishReason: graded.reason,
      xp,
    });
  } catch (e) {
    console.error("[typing-game/tests/finish]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
