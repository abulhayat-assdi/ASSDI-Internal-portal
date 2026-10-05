import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Shared retry-password gate for TypingExam attempts, used by both the
 * STUDENT (internal) and PUBLIC taker flows. A taker's first attempt on an
 * exam never needs a password; every attempt after the first must supply
 * the exam's plaintext retry password, verified against `retryPasswordHash`.
 *
 * Split out on purpose so the two taker types (identified differently —
 * `studentUserId` vs `publicPhone`) share one implementation instead of the
 * near-duplicate inline checks that used to live in each route.
 */
export type RetryIdentity = { studentUserId: string } | { publicPhone: string };

export type RetryGateResult =
  | { ok: true; attemptsUsed: number }
  | { ok: false; status: 401; body: { needsPassword: true } };

export function takerWhere(courseId: string, examId: string, identity: RetryIdentity) {
  return "studentUserId" in identity
    ? { courseId, examId, takerType: "STUDENT" as const, studentUserId: identity.studentUserId }
    : { courseId, examId, takerType: "PUBLIC" as const, publicPhone: identity.publicPhone };
}

/**
 * Attempts already recorded plus runs still in flight (OPEN sessions) —
 * both count as used, so reloading the page mid-exam can't be used to
 * start over without the password.
 */
export async function countUsedAttempts(
  tx: Prisma.TransactionClient,
  courseId: string,
  examId: string,
  identity: RetryIdentity
): Promise<number> {
  const where = takerWhere(courseId, examId, identity);
  const recorded = await tx.typingExamAttempt.count({ where });
  const inFlight = await tx.typingExamSession.count({ where: { ...where, status: "OPEN" } });
  return recorded + inFlight;
}

/** Wrong retry passwords one student may try per hour, across all exams. */
export const STUDENT_PASSWORD_FAILURES_PER_HOUR = 10;

export function studentPasswordLimitKey(userId: string): string {
  return `typing-exam-pw:${userId}`;
}

/** bcrypt check of a supplied retry password against the exam's hash. */
export async function retryPasswordMatches(providedPassword: unknown, retryPasswordHash: string | null): Promise<boolean> {
  return (
    typeof providedPassword === "string" &&
    !!providedPassword &&
    !!retryPasswordHash &&
    (await bcrypt.compare(providedPassword, retryPasswordHash))
  );
}

export async function checkRetryPassword(
  tx: Prisma.TransactionClient,
  courseId: string,
  examId: string,
  identity: RetryIdentity,
  retryPasswordHash: string | null,
  providedPassword: string | undefined
): Promise<RetryGateResult> {
  const attemptsUsed = await countUsedAttempts(tx, courseId, examId, identity);

  if (attemptsUsed > 0) {
    if (!(await retryPasswordMatches(providedPassword, retryPasswordHash))) {
      return { ok: false, status: 401, body: { needsPassword: true } };
    }
  }

  return { ok: true, attemptsUsed };
}
