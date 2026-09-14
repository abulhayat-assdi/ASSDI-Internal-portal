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

export async function checkRetryPassword(
  tx: Prisma.TransactionClient,
  courseId: string,
  examId: string,
  identity: RetryIdentity,
  retryPasswordHash: string | null,
  providedPassword: string | undefined
): Promise<RetryGateResult> {
  const where =
    "studentUserId" in identity
      ? { courseId, examId, takerType: "STUDENT" as const, studentUserId: identity.studentUserId }
      : { courseId, examId, takerType: "PUBLIC" as const, publicPhone: identity.publicPhone };

  const attemptsUsed = await tx.typingExamAttempt.count({ where });

  if (attemptsUsed > 0) {
    const passwordOk =
      !!providedPassword && !!retryPasswordHash && (await bcrypt.compare(providedPassword, retryPasswordHash));
    if (!passwordOk) {
      return { ok: false, status: 401, body: { needsPassword: true } };
    }
  }

  return { ok: true, attemptsUsed };
}
