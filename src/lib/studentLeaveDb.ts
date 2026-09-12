import type { Prisma } from "@prisma/client";

/**
 * Creates a student leave request.
 */
export async function createStudentLeaveRequest(
    tx: Prisma.TransactionClient,
    data: {
        courseId: string;
        studentUid: string;
        studentName: string;
        studentRoll: string;
        studentPhone?: string | null;
        studentBatchName: string;
        startDate: string;
        endDate: string;
        reason: string;
        attachmentUrl?: string | null;
        attachmentName?: string | null;
        status: "PENDING" | "APPROVED" | "REJECTED";
        reviewedBy?: string | null;
    }
) {
    return tx.studentLeaveRequest.create({
        data: {
            courseId: data.courseId,
            studentUid: data.studentUid,
            studentName: data.studentName,
            studentRoll: data.studentRoll,
            studentPhone: data.studentPhone || null,
            studentBatchName: data.studentBatchName,
            startDate: data.startDate,
            endDate: data.endDate,
            reason: data.reason,
            attachmentUrl: data.attachmentUrl || null,
            attachmentName: data.attachmentName || null,
            status: data.status,
            reviewedBy: data.reviewedBy || null,
        },
    });
}
