/**
 * POST /api/typing-game/custom-missions/[id]/attempts/[attemptId]/submit
 *
 * Same trust model as the catalog submit route: the client sends raw
 * evidence (typed text, elapsed time, correction counts); the server
 * recomputes correctness/accuracy/WPM from its own stored `expected_text`
 * snapshot via the same pure engine functions, then persists via the
 * atomic fn_submit_custom_mission_attempt (which also evaluates the
 * mission's completion rule and mints the reward exactly once).
 */
import { NextResponse } from "next/server";
import { computeRawMetrics, computeScore } from "@/lib/typing-game/scoring";
import { diffExpected, validateSubmission } from "@/lib/typing-game/game-engine";
import enErrors from "@/messages/typing-game/en/errors.json";
import {
  customMissionContext,
  isRecord,
  toCustomMissionError,
  unknownMission,
  validUuid,
} from "../../../../_helper";

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; attemptId: string }> },
): Promise<Response> {
  const deps = await customMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id, attemptId } = await ctx.params;
  if (!validUuid(id) || !validUuid(attemptId)) return unknownMission();

  const body: unknown = await req.json().catch(() => ({}));
  if (!isRecord(body) || typeof body.typedText !== "string") {
    return fail("MALFORMED_SUBMISSION", enErrors.requiredField, 400);
  }
  const typedChars = Array.from(body.typedText);
  const elapsedMs = typeof body.elapsedMs === "number" ? body.elapsedMs : NaN;
  const corrections =
    typeof body.corrections === "number" ? Math.floor(body.corrections) : 0;
  const errorStrokes =
    typeof body.errorStrokes === "number" ? Math.floor(body.errorStrokes) : 0;

  const attempt = await deps.store.getAttempt(attemptId);
  if (!attempt || attempt.missionId !== id) {
    return fail("ATTEMPT_NOT_FOUND", enErrors.fileNotAvailable, 404);
  }
  if (attempt.status !== "started") {
    return fail("ALREADY_FINALIZED", enErrors.storageUnavailable, 409);
  }

  const expectedChars = Array.from(attempt.expectedText);
  const diff = diffExpected(attempt.expectedText, body.typedText);
  const metrics = computeRawMetrics({
    correctChars: diff.correctChars,
    typedLength: typedChars.length,
    errorStrokes,
    corrections,
    elapsedMs,
    expectedLength: expectedChars.length,
  });
  const verdict = validateSubmission(
    {
      expectedLength: expectedChars.length,
      typedLength: typedChars.length,
      correctChars: diff.correctChars,
      corrections,
      elapsedMs,
    },
    {},
  );
  if (
    !verdict.ok &&
    (verdict.rejectReason === "INVALID_EVIDENCE" || typedChars.length === 0)
  ) {
    return fail("MALFORMED_SUBMISSION", enErrors.requiredField, 400);
  }
  if (!verdict.ok) {
    // Plausibility check failed for some other reason (e.g. an implausible
    // WPM) — never persist or let this count toward qualification/reward.
    // The attempt row stays "started"; the student can just retry.
    return NextResponse.json({
      status: "rejected",
      accuracy: metrics.accuracy,
      effectiveWpm: metrics.effectiveWpm,
      score: 0,
      reason: verdict.rejectReason ?? "REJECTED",
      qualifies: false,
      completed: false,
      newlyCompleted: false,
    });
  }
  const score = computeScore(metrics, "standard");

  try {
    const result = await deps.store.submitAttempt(attemptId, {
      typedText: body.typedText,
      elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : metrics.durationMs,
      corrections,
      errorStrokes,
      incorrectChars: metrics.incorrectCharacters,
      accuracy: metrics.accuracy,
      effectiveWpm: metrics.effectiveWpm,
      score: score.score,
    });
    return NextResponse.json({
      status: result.status,
      accuracy: metrics.accuracy,
      effectiveWpm: metrics.effectiveWpm,
      score: score.score,
      qualifies: result.qualifies,
      completed: result.completed,
      newlyCompleted: result.newlyCompleted,
    });
  } catch (e) {
    return toCustomMissionError(e);
  }
}
