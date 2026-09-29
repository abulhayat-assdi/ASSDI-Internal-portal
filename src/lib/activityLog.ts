import type { Prisma } from "@prisma/client";

interface LogInput {
    courseId: string;
    actorUid: string;
    actorRole: "ADMIN" | "TEACHER" | "STUDENT";
    actionType: string;
    targetType: string;
    targetId: string;
    description: string;
}

/**
 * Appends one entry to the platform-wide activity log (course-wise log on
 * the Audit page). Never throws — an audit write must not be able to fail
 * the action it is recording.
 */
export async function logActivity(tx: Prisma.TransactionClient, input: LogInput): Promise<void> {
    try {
        await tx.activityLog.create({ data: input });
    } catch (error) {
        console.error("[ActivityLog] could not write entry:", error);
    }
}
