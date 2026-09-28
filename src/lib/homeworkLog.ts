import type { Prisma } from "@prisma/client";
import type { JWTPayload } from "@/lib/auth";

/** Every homework audit entry uses one of these action types (ActivityLog.actionType). */
export const HOMEWORK_ACTIONS = [
    "HOMEWORK_ASSIGNMENT_CREATED",
    "HOMEWORK_ASSIGNMENT_UPDATED",
    "HOMEWORK_ASSIGNMENT_DELETED",
    "HOMEWORK_ASSIGNMENT_SHARED",
    "HOMEWORK_ASSIGNMENT_UNSHARED",
    "HOMEWORK_FOLDER_VIEWED",
    "HOMEWORK_SUBMISSION_DELETED",
    "HOMEWORK_BATCH_PURGED",
] as const;

export type HomeworkAction = (typeof HOMEWORK_ACTIONS)[number];

interface LogInput {
    action: HomeworkAction;
    targetType: "homework_assignment" | "homework_submission" | "batch";
    targetId: string;
    description: string;
}

/**
 * Appends one entry to the homework log. Never throws — an audit write must
 * not be able to fail the action it is recording.
 */
export async function logHomeworkActivity(
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
        console.error("[HomeworkLog] could not write entry:", error);
    }
}
