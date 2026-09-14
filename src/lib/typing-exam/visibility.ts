import type { Prisma } from "@prisma/client";

/**
 * Shared student-visibility + eligibility check for a TypingExam, used by
 * both the detail GET and the attempt POST (the latter re-validates
 * independently rather than trusting that GET was called first).
 *
 * Split out of route.ts on purpose: Next.js App Router route modules may
 * only export recognized route handlers / config, so a shared helper can't
 * live there.
 */
export async function loadVisibleExam(
    tx: Prisma.TransactionClient,
    courseId: string,
    examId: string,
    studentBatchName: string
) {
    const exam = await tx.typingExam.findUnique({ where: { id: examId, courseId } });
    if (!exam) return { error: "Not found" as const, status: 404 as const };

    if (exam.accessType !== "INTERNAL" || !exam.isActive) {
        return { error: "This exam is not available" as const, status: 404 as const };
    }

    const batchNames = Array.isArray(exam.batchNames) ? (exam.batchNames as unknown[]) : [];
    if (!batchNames.some((b) => typeof b === "string" && b === studentBatchName)) {
        return { error: "This exam is not available for your batch" as const, status: 403 as const };
    }

    const now = new Date();
    if (exam.scheduleStart && now < exam.scheduleStart) {
        return { error: "This exam has not started yet" as const, status: 403 as const };
    }
    if (exam.scheduleEnd && now > exam.scheduleEnd) {
        return { error: "This exam has ended" as const, status: 403 as const };
    }

    return { exam };
}
