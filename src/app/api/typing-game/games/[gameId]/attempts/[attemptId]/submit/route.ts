/**
 * POST /api/games/[gameId]/attempts/[attemptId]/submit
 *
 * Trust model: the client sends raw evidence (typed text, elapsed time,
 * correction counts). The server recomputes correctness from its stored
 * prompt snapshot, derives accuracy/WPM itself, validates plausibility, and
 * persists via the atomic fn_submit_attempt. Client-claimed WPM/accuracy/
 * score are cross-checked when present, never trusted.
 *
 * Responses: 200 {status: validated|rejected, ...} · 400 malformed ·
 * 401 anonymous · 404 unknown/foreign/mismatched · 409 already finalized ·
 * 410 expired · 429/500 store failures.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  computeRawMetrics,
  computeScore,
} from "@/lib/typing-game/scoring";
import { alignKeys } from "@/lib/typing-game/adaptive";
import { diffExpected, isTerminal, validateSubmission } from "@/lib/typing-game/game-engine";
import {
  asDifficulty,
  decodeTimeline,
  digestOf,
  digestsMatch,
  isRealMechanic,
  parseTimelineDeltas,
  resolveParams,
  runMechanic,
  segmentUnits,
  validateTimeline,
  type MechanicDigest,
  type MechanicOutcome,
} from "@/lib/typing-game/mechanics";
import { getSession, unauthorized, type Session } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import {
  createSupabaseAttemptStore,
  type AttemptStore,
} from "@/lib/typing-game/server/attempt-store";
import {
  createSupabaseAdaptiveStore,
  type AdaptiveStore,
} from "@/lib/typing-game/server/adaptive-store";
import enErrors from "@/messages/typing-game/en/errors.json";

export interface SubmitDeps {
  session: Session | null;
  store: AttemptStore | null;
  /**
   * Adaptive hook (M15, best-effort): after a validated submit, align
   * expected vs typed position-wise and record key evidence, then
   * refresh the cached profile. Failures never fail the submit —
   * the sweeper replays refresh later.
   */
  adaptive?: AdaptiveStore | null;
}

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Read the client's claimed mechanic digest. Advisory only: it is compared
 * against the server's replay to flag disagreement, and is never stored or
 * scored, so a malformed value simply means "nothing to compare against".
 */
function parseClaimedDigest(value: unknown): MechanicDigest | null {
  if (!isRecord(value)) return null;
  const {
    mechanic,
    cleared,
    endReason,
    livesLost,
    unitsCleared,
    unitsMissed,
    endedAtChar,
  } = value;
  if (
    typeof mechanic !== "string" ||
    typeof cleared !== "boolean" ||
    typeof endReason !== "string" ||
    typeof livesLost !== "number" ||
    typeof unitsCleared !== "number" ||
    typeof unitsMissed !== "number" ||
    typeof endedAtChar !== "number"
  ) {
    return null;
  }
  return {
    mechanic,
    cleared,
    endReason,
    livesLost,
    unitsCleared,
    unitsMissed,
    endedAtChar,
  } as MechanicDigest;
}

async function handleSubmitAttempt(
  gameSlug: string,
  attemptId: string,
  body: unknown,
  deps: SubmitDeps,
): Promise<Response> {
  if (!deps.session) return unauthorized(enErrors.unauthorizedDescription);
  if (!deps.store) {
    return fail("SERVICE_UNAVAILABLE", enErrors.storageUnavailable, 503);
  }
  if (!isRecord(body) || typeof body.typedText !== "string") {
    return fail("MALFORMED_SUBMISSION", enErrors.requiredField, 400);
  }
  const typedChars = Array.from(body.typedText);
  const elapsedMs = typeof body.elapsedMs === "number" ? body.elapsedMs : NaN;
  const corrections =
    typeof body.corrections === "number" ? Math.floor(body.corrections) : 0;
  const errorStrokes =
    typeof body.errorStrokes === "number" ? Math.floor(body.errorStrokes) : 0;
  const claimedAccuracy =
    typeof body.claimedAccuracy === "number" ? body.claimedAccuracy : undefined;
  const claimedWpm =
    typeof body.claimedWpm === "number" ? body.claimedWpm : undefined;

  const attempt = await deps.store.getAttempt(attemptId);
  if (!attempt || attempt.userId !== deps.session.userId || attempt.gameSlug !== gameSlug) {
    // One opaque 404: no existence oracle, no owner oracle, no game oracle.
    return fail("ATTEMPT_NOT_FOUND", enErrors.fileNotAvailable, 404);
  }
  if (isTerminal(attempt.status)) {
    return fail("ALREADY_FINALIZED", enErrors.storageUnavailable, 409);
  }

  // One catalog read serves the mechanic replay, the case-sensitivity rule
  // and the countdown gate below. A failure here must not turn valid runs
  // into rejections, so every consumer degrades rather than throwing.
  let game: Awaited<ReturnType<AttemptStore["getActiveGame"]>> = null;
  try {
    game = await deps.store.getActiveGame(gameSlug);
  } catch {
    game = null;
  }

  const expectedChars = Array.from(attempt.expectedText);
  const caseSensitive = game?.caseSensitive ?? true;
  const diff = diffExpected(attempt.expectedText, body.typedText, caseSensitive);
  const metrics = computeRawMetrics({
    correctChars: diff.correctChars,
    typedLength: typedChars.length,
    errorStrokes,
    corrections,
    elapsedMs,
    expectedLength: expectedChars.length,
  });
  let verdict = validateSubmission(
    {
      expectedLength: expectedChars.length,
      typedLength: typedChars.length,
      correctChars: diff.correctChars,
      corrections,
      elapsedMs,
      claimedAccuracy,
      claimedWpm,
    },
    {},
  );

  // Countdown enforcement (server-side): the client countdown is display
  // only, so a scripted client could otherwise take unlimited time on a
  // timed game and still validate. Fails open when the catalog read failed —
  // a store outage must not turn valid runs into rejections.
  // 5s grace covers submit latency after the client auto-submits at 0:00.
  if (verdict.ok && Number.isFinite(elapsedMs)) {
    const limit = game?.timingLimitSeconds;
    if (
      game?.timingKind === "countdown" &&
      typeof limit === "number" &&
      limit > 0 &&
      elapsedMs > limit * 1000 + 5000
    ) {
      verdict = {
        ok: false,
        rejectReason: "TIME_EXCEEDED",
        flags: verdict.flags,
        recomputed: verdict.recomputed,
      };
    }
  }

  // ---------------------------------------------------------------------
  // Mechanic replay. For the ten mechanics with real rules, the server
  // re-runs the mechanic over its OWN prompt plus the submitted keystroke
  // timeline and keeps its own verdict. The client sends its outcome digest
  // purely so a disagreement can be flagged — the stored result is always
  // the server's. A missing or malformed timeline degrades to "no mechanic
  // outcome" rather than rejecting: the typing result stands on its own.
  // ---------------------------------------------------------------------
  let mechanicOutcome: MechanicOutcome | null = null;
  let mechanicFlag: string | null = null;
  if (verdict.ok && game && isRealMechanic(game.mechanic)) {
    const deltas = parseTimelineDeltas(body.timeline, expectedChars.length * 2 + 100);
    if (deltas === null) {
      mechanicFlag = "MECHANIC_NO_TIMELINE";
    } else {
      const timeline = decodeTimeline(deltas);
      const check = validateTimeline(timeline, typedChars.length, elapsedMs);
      if (!check.ok) {
        mechanicFlag = check.reason ?? "MECHANIC_BAD_TIMELINE";
      } else {
        const units = segmentUnits(attempt.expectedText);
        mechanicOutcome = runMechanic({
          mechanic: game.mechanic,
          expected: expectedChars,
          typed: typedChars,
          timeline,
          units,
          params: resolveParams(
            game.mechanic,
            game.config,
            asDifficulty(attempt.difficulty),
            units.length,
          ),
          caseSensitive,
        });
        const claimed = parseClaimedDigest(body.mechanicDigest);
        if (claimed && !digestsMatch(claimed, digestOf(mechanicOutcome))) {
          mechanicFlag = "MECHANIC_DIGEST_MISMATCH";
        }
      }
    }
  }
  if (mechanicFlag) verdict.flags.push(mechanicFlag);

  if (
    !verdict.ok &&
    (verdict.rejectReason === "INVALID_EVIDENCE" || typedChars.length === 0)
  ) {
    return fail("MALFORMED_SUBMISSION", enErrors.requiredField, 400);
  }

  const score = verdict.ok
    ? computeScore(metrics, attempt.scoringProfile)
    : { score: 0, profileId: attempt.scoringProfile };

  try {
    const status = await deps.store.submitAttempt({
      attemptId: attempt.id,
      raw: {
        durationMs: metrics.durationMs,
        totalCharacters: metrics.totalCharacters,
        correctCharacters: metrics.correctCharacters,
        incorrectCharacters: metrics.incorrectCharacters,
        correctedCharacters: metrics.correctedCharacters,
        errorStrokes: metrics.errorStrokes,
        completedWords: metrics.completedWords,
        accuracy: metrics.accuracy,
        rawWpm: metrics.rawWpm,
        effectiveWpm: metrics.effectiveWpm,
        completion: metrics.completion,
        flags: verdict.flags,
        // Display-only mechanic record. Never an input to score/accuracy/WPM,
        // so adding a field here can never change what an attempt is worth.
        ...(mechanicOutcome ? { mechanic: mechanicOutcome } : {}),
      },
      score: score.score,
      accuracy: metrics.accuracy,
      effectiveWpm: metrics.effectiveWpm,
      valid: verdict.ok,
      reason: verdict.ok ? null : (verdict.rejectReason ?? "REJECTED"),
    });
    if (status !== "validated") {
      return NextResponse.json({
        status,
        score: score.score,
        accuracy: metrics.accuracy,
        effectiveWpm: metrics.effectiveWpm,
        reason: verdict.rejectReason,
        progression: null,
        mechanic: mechanicOutcome,
      });
    }
    // Validated: feed the adaptive loop (best-effort; never fails submit).
    if (deps.adaptive) {
      try {
        const alignment = alignKeys(attempt.expectedText, body.typedText);
        await deps.adaptive.recordAttempt({
          attemptId: attempt.id,
          keys: alignment.keys,
          pairs: alignment.pairs,
        });
        await deps.adaptive.refreshProfile();
      } catch {
        // Sweep replays refresh later; the attempt stays validated.
      }
    }
    // Validated: run the progression pipeline. A failure here leaves a
    // validated-but-unrewarded attempt (safe: idempotent replay via SQL).
    try {
      const progression = await deps.store.processProgression(attempt.id);
      return NextResponse.json({
        status,
        score: score.score,
        accuracy: metrics.accuracy,
        effectiveWpm: metrics.effectiveWpm,
        reason: null,
        progression,
        mechanic: mechanicOutcome,
      });
    } catch {
      return fail("PROGRESSION_FAILED", enErrors.storageUnavailable, 500);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "SUBMIT_FAILED";
    if (message.includes("ALREADY_FINALIZED")) {
      return fail("ALREADY_FINALIZED", enErrors.storageUnavailable, 409);
    }
    if (message.includes("ATTEMPT_EXPIRED")) {
      return fail("ATTEMPT_EXPIRED", enErrors.storageUnavailable, 410);
    }
    if (message.includes("NOT_OWNER") || message.includes("ATTEMPT_NOT_FOUND")) {
      return fail("ATTEMPT_NOT_FOUND", enErrors.fileNotAvailable, 404);
    }
    return fail("SUBMIT_FAILED", enErrors.storageUnavailable, 500);
  }
}

async function readBody(req: NextRequest): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    return {};
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ gameId: string; attemptId: string }> },
): Promise<Response> {
  const session = await getSession();
  const client = await userDbClient();
  return handleSubmitAttempt(
    (await ctx.params).gameId,
    (await ctx.params).attemptId,
    await readBody(req),
    {
      session,
      store: client ? createSupabaseAttemptStore(client) : null,
      adaptive: client ? createSupabaseAdaptiveStore(client) : null,
    },
  );
}
