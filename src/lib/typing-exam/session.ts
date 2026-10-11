// Pure, server-authoritative rules for turning a client snapshot into a
// graded attempt. No DB access here (see sessionStore.ts) so every rule is
// unit-testable.

import type { FinishReason } from "./engine";
import { cleanExamText } from "./examText";
import { isPassageComplete, maxTypedLength, passageWords } from "./words";
import { gradeAttempt, scoreAttempt, type GradeThresholds, type ExamResultTier, type ScoreResult } from "./scoring";

export const ENGINE_VERSION = 3;

/**
 * How long after a session starts it may still be finalized by its own
 * taker before finalizeStaleSessions takes over: the exam duration plus
 * this grace (covers the 3-2-1 countdown, a slow submit and retries).
 */
export const STALE_GRACE_MS = 2 * 60 * 1000;

/**
 * New typing is accepted from the client only until the exam duration plus
 * this much has passed since the session opened (covers the countdown and a
 * slow, retried submit). After that, autosaves are refused and a submission
 * is graded from the last in-time autosave instead — so freezing the page
 * (DevTools, a suspended laptop) can never buy extra typing time.
 */
export const LATE_DATA_MS = 60 * 1000;

export function acceptsClientData(durationMs: number, serverElapsedMs: number): boolean {
  return serverElapsedMs <= durationMs + LATE_DATA_MS;
}

const MAX_KEYSTROKES = 1_000_000;
const FINISH_REASONS: readonly FinishReason[] = ["TIME_UP", "COMPLETED", "ABANDONED"];

/** What the client sends on autosave and on submit. */
export interface ClientSnapshot {
  typedText: string;
  keystrokesTotal: number;
  keystrokesCorrect: number;
  elapsedMs: number;
  finishReason: FinishReason | null;
}

/**
 * Validates an untrusted body into a snapshot. Accepts both the v2 shape
 * and the legacy `{ typedText, elapsedSeconds }` shape (an old browser tab
 * still open during a deploy), which maps to a TIME_UP with no keystrokes.
 * Returns null when the body is unusable.
 */
export function parseClientSnapshot(body: unknown, examText: string): ClientSnapshot | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.typedText !== "string") return null;

  const typedText = b.typedText.normalize("NFC").slice(0, maxTypedLength(cleanExamText(examText)));
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const int = (v: unknown) => {
    const n = num(v);
    return n === null ? 0 : Math.min(MAX_KEYSTROKES, Math.max(0, Math.floor(n)));
  };

  const elapsedMs = num(b.elapsedMs) ?? (num(b.elapsedSeconds) !== null ? (num(b.elapsedSeconds) as number) * 1000 : null);
  if (elapsedMs === null) return null;

  const reason = FINISH_REASONS.includes(b.finishReason as FinishReason) ? (b.finishReason as FinishReason) : null;
  const isLegacy = b.elapsedMs === undefined && b.elapsedSeconds !== undefined;

  return {
    typedText,
    keystrokesTotal: int(b.keystrokesTotal),
    keystrokesCorrect: int(b.keystrokesCorrect),
    elapsedMs: Math.max(0, elapsedMs),
    finishReason: reason ?? (isLegacy ? "TIME_UP" : null),
  };
}

/**
 * Clamps a snapshot's client clocks to what the server can vouch for:
 * nothing longer than the exam, nothing longer than the session has existed.
 */
export function clampSnapshotToServer(s: ClientSnapshot, durationMs: number, serverElapsedMs: number): ClientSnapshot {
  const bound = Math.max(0, Math.min(durationMs, serverElapsedMs));
  return {
    ...s,
    elapsedMs: Math.min(s.elapsedMs, bound),
  };
}

/**
 * The time WPM is computed over (standard timed-test rules):
 *  - TIME_UP: the full exam duration — stopping halfway does not shrink it.
 *  - COMPLETED: the time it took to type the whole passage.
 *  - ABANDONED (tab closed / connection lost, never submitted): the full
 *    duration, exactly like stopping halfway. Anything shorter would let a
 *    fast burst followed by closing the tab outscore someone who kept going.
 * TIME_UP and COMPLETED are bounded by the server-side clock (a client can
 * not claim more time than the session has existed). ABANDONED is not: a
 * longer time only ever lowers the score, so there is nothing to exploit.
 */
export function resolveScoringTimeMs(
  reason: FinishReason,
  s: Pick<ClientSnapshot, "elapsedMs">,
  durationMs: number,
  serverElapsedMs: number
): number {
  const bound = Math.max(0, Math.min(durationMs, serverElapsedMs));
  switch (reason) {
    case "TIME_UP":
      return bound;
    case "COMPLETED":
      return Math.min(s.elapsedMs, bound);
    case "ABANDONED":
      return durationMs;
  }
}

export interface GradedAttempt {
  score: ScoreResult;
  result: ExamResultTier;
  reason: FinishReason;
  timeMs: number;
  durationTakenSeconds: number;
}

export function gradeSnapshot(params: {
  examText: string;
  durationMs: number;
  thresholds: GradeThresholds;
  snapshot: ClientSnapshot;
  serverElapsedMs: number;
  /** Used when the snapshot carries no reason (e.g. the taker never submitted). */
  fallbackReason: FinishReason;
}): GradedAttempt {
  const { durationMs, thresholds, serverElapsedMs, fallbackReason } = params;
  const examText = cleanExamText(params.examText);
  const snapshot = clampSnapshotToServer(params.snapshot, durationMs, serverElapsedMs);
  let reason = snapshot.finishReason ?? fallbackReason;
  // A "completed" claim with the passage not fully typed is not a completion.
  if (reason === "COMPLETED" && !isPassageComplete(passageWords(examText), snapshot.typedText)) reason = fallbackReason;

  const timeMs = resolveScoringTimeMs(reason, snapshot, durationMs, serverElapsedMs);
  const score = scoreAttempt({
    originalText: examText,
    typedText: snapshot.typedText,
    elapsedMs: timeMs,
    keystrokes: { total: snapshot.keystrokesTotal, correct: snapshot.keystrokesCorrect },
  });
  return {
    score,
    result: gradeAttempt(score.wpm, score.accuracy, thresholds),
    reason,
    timeMs,
    durationTakenSeconds: Math.round(timeMs / 1000),
  };
}

/** Request bodies may arrive as text/plain from navigator.sendBeacon. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    const parsed = text ? JSON.parse(text) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
