import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { Prisma, TypingExam, TypingExamSession } from "@prisma/client";
import type { FinishReason } from "./engine";
import {
  ENGINE_VERSION,
  STALE_GRACE_MS,
  acceptsClientData,
  clampSnapshotToServer,
  gradeSnapshot,
  type ClientSnapshot,
} from "./session";
import type { ExamResultTier } from "./scoring";
import { countUsedAttempts, takerWhere, type RetryIdentity } from "./retryGate";

// DB side of the typing-exam engine. Lifecycle of one run:
//
//   startSession      -> OPEN session row (retry-password gate runs here)
//   saveProgress      -> autosave every few seconds + on tab hide/close
//   finalizeSession   -> exactly one TypingExamAttempt, session FINALIZED
//
// If the taker never submits (closed the tab, lost the network, browser
// crashed), finalizeStaleSessions grades the last autosaved progress once
// the exam window has passed. It runs lazily from every endpoint that reads
// attempts, so the result is in place before anyone looks at the list.
//
// Finalizing takes a row lock on the session (and start/sweep a per-taker
// advisory lock), so a submit racing a sweep, a retried submit or a second
// tab can never produce two attempts for one run.

export type Taker =
  | { type: "STUDENT"; userId: string; name: string; roll: string; batchName: string }
  | { type: "PUBLIC"; name: string; roll: string; phone: string };

type ExamForGrading = Pick<
  TypingExam,
  "id" | "courseId" | "examText" | "durationSeconds" | "passWpm" | "passAccuracy" | "failWpm" | "failAccuracy"
>;

export interface RecordedResult {
  attemptId: string;
  wpm: number;
  accuracy: number;
  result: ExamResultTier;
  /** false when the run had already been finalized (a retried submit). */
  fresh: boolean;
}

function identityOf(taker: Taker): RetryIdentity {
  return taker.type === "STUDENT" ? { studentUserId: taker.userId } : { publicPhone: taker.phone };
}

function takerLockKey(examId: string, taker: Taker): string {
  return `typing-exam:${examId}:${taker.type === "STUDENT" ? `s:${taker.userId}` : `p:${taker.phone}`}`;
}

function sessionTaker(s: TypingExamSession): Taker {
  return s.takerType === "STUDENT"
    ? { type: "STUDENT", userId: s.studentUserId ?? "", name: s.studentName, roll: s.studentRoll, batchName: s.studentBatchName }
    : { type: "PUBLIC", name: s.publicName, roll: s.publicRoll, phone: s.publicPhone };
}

async function lockTaker(tx: Prisma.TransactionClient, examId: string, taker: Taker) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${takerLockKey(examId, taker)}))`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time check of a PUBLIC taker's bearer token. */
export function sessionTokenMatches(session: Pick<TypingExamSession, "tokenHash">, token: unknown): boolean {
  if (typeof token !== "string" || !token || !session.tokenHash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(session.tokenHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Creates the attempt row for a graded snapshot. The single place an
 * engine-v2 attempt is written, for both session and session-less paths.
 */
async function writeAttempt(
  tx: Prisma.TransactionClient,
  exam: ExamForGrading,
  taker: Taker,
  params: {
    snapshot: ClientSnapshot;
    serverElapsedMs: number;
    fallbackReason: FinishReason;
    attemptNumber: number;
    sessionId: string | null;
    startedAt: Date;
    now: Date;
  }
): Promise<RecordedResult> {
  const durationMs = exam.durationSeconds * 1000;
  const graded = gradeSnapshot({
    examText: exam.examText,
    durationMs,
    thresholds: exam,
    snapshot: params.snapshot,
    serverElapsedMs: params.serverElapsedMs,
    fallbackReason: params.fallbackReason,
  });
  const { score } = graded;

  const attempt = await tx.typingExamAttempt.create({
    data: {
      courseId: exam.courseId,
      examId: exam.id,
      takerType: taker.type,
      ...(taker.type === "STUDENT"
        ? { studentUserId: taker.userId, studentName: taker.name, studentRoll: taker.roll, studentBatchName: taker.batchName }
        : { publicName: taker.name, publicRoll: taker.roll, publicPhone: taker.phone }),
      attemptNumber: params.attemptNumber,
      wpm: score.wpm,
      rawWpm: score.rawWpm,
      accuracy: score.accuracy,
      correctChars: score.correctChars,
      totalChars: score.totalChars,
      keystrokesTotal: params.snapshot.keystrokesTotal,
      keystrokesCorrect: params.snapshot.keystrokesCorrect,
      typedText: params.snapshot.typedText,
      durationTakenSeconds: graded.durationTakenSeconds,
      finishReason: graded.reason,
      result: graded.result,
      engineVersion: ENGINE_VERSION,
      sessionId: params.sessionId,
      startedAt: params.startedAt,
      submittedAt: params.now,
    },
  });

  return { attemptId: attempt.id, wpm: score.wpm, accuracy: score.accuracy, result: graded.result, fresh: true };
}

function storedSnapshot(s: TypingExamSession): ClientSnapshot {
  return {
    typedText: s.typedText,
    keystrokesTotal: s.keystrokesTotal,
    keystrokesCorrect: s.keystrokesCorrect,
    elapsedMs: s.elapsedMs,
    finishReason: s.finishReason,
  };
}

/** Re-reads a session under a row lock so concurrent finalizers serialize. */
async function lockSession(tx: Prisma.TransactionClient, sessionId: string) {
  await tx.$queryRaw`SELECT id FROM typing_exam_sessions WHERE id = ${sessionId} FOR UPDATE`;
  return tx.typingExamSession.findUnique({ where: { id: sessionId } });
}

async function resultOfFinalized(tx: Prisma.TransactionClient, s: TypingExamSession): Promise<RecordedResult | null> {
  if (!s.attemptId) return null;
  const a = await tx.typingExamAttempt.findUnique({ where: { id: s.attemptId } });
  return a ? { attemptId: a.id, wpm: a.wpm, accuracy: a.accuracy, result: a.result, fresh: false } : null;
}

/**
 * Turns an OPEN session into its attempt. With `submitted`, the taker's own
 * final snapshot is graded; without it, the last autosaved progress is.
 * Idempotent: finalizing an already-finalized session returns its result.
 */
export async function finalizeSession(
  tx: Prisma.TransactionClient,
  exam: ExamForGrading,
  sessionId: string,
  submitted: ClientSnapshot | null,
  now = new Date()
): Promise<RecordedResult | null> {
  const session = await lockSession(tx, sessionId);
  if (!session || session.examId !== exam.id) return null;
  if (session.status === "FINALIZED") return resultOfFinalized(tx, session);
  if (session.status !== "OPEN") return null;

  const durationMs = exam.durationSeconds * 1000;
  const serverElapsedMs = now.getTime() - session.createdAt.getTime();
  const saved = storedSnapshot(session);

  // Never let a submission carry LESS than what autosave already holds
  // (e.g. an old tab replaying a stale payload): keep whichever has more.
  // A submission arriving after the late-data cutoff only contributes its
  // finish reason; the typing itself comes from the last in-time autosave.
  let snapshot = saved;
  if (submitted && !acceptsClientData(durationMs, serverElapsedMs)) {
    snapshot = { ...saved, finishReason: saved.finishReason ?? submitted.finishReason };
  } else if (submitted) {
    const clamped = clampSnapshotToServer(submitted, durationMs, serverElapsedMs);
    snapshot = clamped.keystrokesTotal >= saved.keystrokesTotal || clamped.finishReason ? clamped : saved;
  }

  const fallbackReason: FinishReason = serverElapsedMs >= durationMs ? "TIME_UP" : "ABANDONED";
  const recorded = await writeAttempt(tx, exam, sessionTaker(session), {
    snapshot,
    serverElapsedMs,
    // An autosave-only finalize is a taker who never submitted.
    fallbackReason: submitted ? fallbackReason : "ABANDONED",
    attemptNumber: session.attemptNumber,
    sessionId: session.id,
    startedAt: session.createdAt,
    now,
  });

  await tx.typingExamSession.update({
    where: { id: session.id },
    data: { status: "FINALIZED", attemptId: recorded.attemptId, finalizedAt: now },
  });
  return recorded;
}

/**
 * Grades every OPEN session of the course (or one exam) whose exam window
 * has passed. Safe to call from any read path; it is a cheap no-op when
 * nothing is stale.
 */
export async function finalizeStaleSessions(
  tx: Prisma.TransactionClient,
  scope: { courseId: string; examId?: string },
  now = new Date()
): Promise<void> {
  const open = await tx.typingExamSession.findMany({
    where: { courseId: scope.courseId, ...(scope.examId ? { examId: scope.examId } : {}), status: "OPEN" },
    include: { exam: true },
    orderBy: { createdAt: "asc" },
  });
  for (const s of open) {
    const deadline = s.createdAt.getTime() + s.exam.durationSeconds * 1000 + STALE_GRACE_MS;
    if (now.getTime() < deadline) continue;
    await lockTaker(tx, s.examId, sessionTaker(s));
    await finalizeSession(tx, s.exam, s.id, null, now);
  }
}

export type StartResult =
  | { ok: true; sessionId: string; token: string | null; attemptNumber: number }
  | { ok: false; needsPassword: true };

/**
 * Opens a new run. Any earlier run of this taker that is still OPEN (page
 * reloaded mid-exam, second tab) is graded first from its autosave — it
 * counts as an attempt, so reloading can never be used to dodge a result.
 */
export async function startSession(
  tx: Prisma.TransactionClient,
  exam: ExamForGrading & Pick<TypingExam, "retryPasswordHash">,
  taker: Taker,
  passwordOk: (attemptsUsed: number) => Promise<boolean>,
  now = new Date()
): Promise<StartResult> {
  await lockTaker(tx, exam.id, taker);

  const used = await countUsedAttempts(tx, exam.courseId, exam.id, identityOf(taker));
  if (used > 0 && !(await passwordOk(used))) return { ok: false, needsPassword: true };

  const open = await tx.typingExamSession.findMany({
    where: { ...takerWhere(exam.courseId, exam.id, identityOf(taker)), status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });
  for (const s of open) await finalizeSession(tx, exam, s.id, null, now);

  const attempts = await tx.typingExamAttempt.count({ where: takerWhere(exam.courseId, exam.id, identityOf(taker)) });
  const token = taker.type === "PUBLIC" ? randomBytes(32).toString("base64url") : null;

  const session = await tx.typingExamSession.create({
    data: {
      courseId: exam.courseId,
      examId: exam.id,
      takerType: taker.type,
      ...(taker.type === "STUDENT"
        ? { studentUserId: taker.userId, studentName: taker.name, studentRoll: taker.roll, studentBatchName: taker.batchName }
        : { publicName: taker.name, publicRoll: taker.roll, publicPhone: taker.phone }),
      tokenHash: token ? hashToken(token) : "",
      attemptNumber: attempts + 1,
      createdAt: now,
    },
  });
  return { ok: true, sessionId: session.id, token, attemptNumber: attempts + 1 };
}

/**
 * Autosave. Only moves forward: a snapshot with fewer keystrokes than the
 * stored one (an out-of-order request) is ignored.
 */
export async function saveProgress(
  tx: Prisma.TransactionClient,
  exam: ExamForGrading,
  session: TypingExamSession,
  snapshot: ClientSnapshot,
  now = new Date()
): Promise<"saved" | "ignored" | "closed"> {
  if (session.status !== "OPEN") return "closed";
  const serverElapsedMs = now.getTime() - session.createdAt.getTime();
  if (!acceptsClientData(exam.durationSeconds * 1000, serverElapsedMs)) return "closed";
  if (snapshot.keystrokesTotal < session.keystrokesTotal && !snapshot.finishReason) return "ignored";

  const s = clampSnapshotToServer(snapshot, exam.durationSeconds * 1000, serverElapsedMs);
  await tx.typingExamSession.update({
    where: { id: session.id },
    data: {
      typedText: s.typedText,
      keystrokesTotal: s.keystrokesTotal,
      keystrokesCorrect: s.keystrokesCorrect,
      elapsedMs: Math.round(s.elapsedMs),
      finishReason: s.finishReason,
      lastProgressAt: now,
    },
  });
  return "saved";
}

/**
 * Submission that arrived without a session id (the start call failed, or
 * an old tab from before this engine). If the taker has an OPEN session it
 * is adopted — they already passed the gate when it opened. Otherwise the
 * retry gate runs and the attempt is recorded directly.
 */
export async function submitWithoutSession(
  tx: Prisma.TransactionClient,
  exam: ExamForGrading,
  taker: Taker,
  snapshot: ClientSnapshot,
  passwordOk: (attemptsUsed: number) => Promise<boolean>,
  now = new Date()
): Promise<{ ok: true; recorded: RecordedResult } | { ok: false; needsPassword: true }> {
  await lockTaker(tx, exam.id, taker);

  const open = await tx.typingExamSession.findFirst({
    where: { ...takerWhere(exam.courseId, exam.id, identityOf(taker)), status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  if (open) {
    const recorded = await finalizeSession(tx, exam, open.id, snapshot, now);
    if (recorded) return { ok: true, recorded };
  }

  const used = await countUsedAttempts(tx, exam.courseId, exam.id, identityOf(taker));
  if (used > 0 && !(await passwordOk(used))) return { ok: false, needsPassword: true };

  const recorded = await writeAttempt(tx, exam, taker, {
    snapshot,
    // No server-side start time exists on this path; the exam duration is the only bound.
    serverElapsedMs: exam.durationSeconds * 1000,
    fallbackReason: "TIME_UP",
    attemptNumber: used + 1,
    sessionId: null,
    startedAt: new Date(now.getTime() - Math.min(snapshot.elapsedMs, exam.durationSeconds * 1000)),
    now,
  });
  return { ok: true, recorded };
}

/** Finds a session owned by this taker (and, for PUBLIC, holding the right token). */
export async function findOwnedSession(
  tx: Prisma.TransactionClient,
  examId: string,
  sessionId: unknown,
  owner: { studentUserId: string } | { token: unknown }
): Promise<TypingExamSession | null> {
  if (typeof sessionId !== "string" || !sessionId) return null;
  const s = await tx.typingExamSession.findUnique({ where: { id: sessionId } });
  if (!s || s.examId !== examId) return null;
  if ("studentUserId" in owner) return s.takerType === "STUDENT" && s.studentUserId === owner.studentUserId ? s : null;
  return s.takerType === "PUBLIC" && sessionTokenMatches(s, owner.token) ? s : null;
}
