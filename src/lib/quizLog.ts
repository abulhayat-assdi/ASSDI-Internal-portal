import type { Prisma } from "@prisma/client";
import type { JWTPayload } from "@/lib/auth";

/** Every quiz audit entry uses one of these action types (ActivityLog.actionType). */
export const QUIZ_ACTIONS = [
    "QUIZ_CREATED",
    "QUIZ_UPDATED",
    "QUIZ_DELETED",
    "QUIZ_PUBLISHED",
    "QUIZ_UNPUBLISHED",
    "QUIZ_QUESTIONS_ADDED",
    "QUIZ_RESULTS_RELEASED",
    "QUIZ_ATTEMPT_SUBMITTED",
    "QUIZ_ANSWER_GRADED",
] as const;

export type QuizAction = (typeof QUIZ_ACTIONS)[number];

interface LogInput {
    action: QuizAction;
    targetType: "quiz" | "quiz_attempt" | "quiz_answer";
    targetId: string;
    description: string;
}

/**
 * Appends one entry to the quiz log. Never throws — an audit write must not
 * be able to fail the action it is recording. Mirrors logHomeworkActivity.
 */
export async function logQuizActivity(
    tx: Prisma.TransactionClient,
    user: Pick<JWTPayload, "id" | "role" | "courseId">,
    input: LogInput
): Promise<void> {
    if (!user.courseId) return;
    try {
        await tx.activityLog.create({
            data: {
                courseId: user.courseId,
                actorUid: user.id,
                actorRole: user.role === "teacher" ? "TEACHER" : "ADMIN",
                actionType: input.action,
                targetType: input.targetType,
                targetId: input.targetId,
                description: input.description,
            },
        });
    } catch (error) {
        console.error("[QuizLog] could not write entry:", error);
    }
}
