import "server-only";
import type { Prisma } from "@prisma/client";
import type { JWTPayload } from "@/lib/auth";

type Tx = Prisma.TransactionClient;

export interface SubmissionAccess {
    /** may open the submission, its files and its comment thread */
    canView: boolean;
    /** may set marks/feedback, return it and write as the teacher in the thread */
    canGrade: boolean;
    isStudentOwner: boolean;
    assignment: { id: string; title: string; teacherUid: string; marksEnabled: boolean; totalMarks: number | null } | null;
}

const NONE: SubmissionAccess = { canView: false, canGrade: false, isStudentOwner: false, assignment: null };

/**
 * Who may see and who may grade one submission.
 *
 * - the submitting student: view (own work, comments) — never grade
 * - admin / super_admin: view + grade
 * - the folder owner (assignment.teacherUid): view + grade
 * - a teacher the folder is shared with: view only (shares are view-only)
 * - submissions with no folder ("Other submissions"): the teacher they were
 *   addressed to by name, which is how the dashboard lists them
 */
export async function submissionAccess(
    tx: Tx,
    user: JWTPayload,
    submission: { studentUid: string; teacherName: string; assignmentId: string | null; courseId: string }
): Promise<SubmissionAccess> {
    if (!user.courseId || submission.courseId !== user.courseId) return NONE;

    const assignment = submission.assignmentId
        ? await tx.homeworkAssignment.findFirst({
            where: { id: submission.assignmentId, courseId: user.courseId },
            select: { id: true, title: true, teacherUid: true, marksEnabled: true, totalMarks: true },
        })
        : null;

    if (user.role === "student") {
        const own = submission.studentUid === user.id;
        return { canView: own, canGrade: false, isStudentOwner: own, assignment };
    }

    const isAdminUser = user.role === "admin" || user.role === "super_admin";
    if (isAdminUser) return { canView: true, canGrade: true, isStudentOwner: false, assignment };
    if (user.role !== "teacher") return NONE;

    if (assignment) {
        if (assignment.teacherUid === user.id) return { canView: true, canGrade: true, isStudentOwner: false, assignment };
        const shared = await tx.homeworkAssignmentShare.count({
            where: { assignmentId: assignment.id, courseId: user.courseId, sharedWithTeacherUid: user.id },
        });
        if (shared > 0) return { canView: true, canGrade: false, isStudentOwner: false, assignment };
    }
    if (submission.teacherName && submission.teacherName === user.displayName) {
        return { canView: true, canGrade: true, isStudentOwner: false, assignment };
    }
    return NONE;
}

/** Can this user grade every submission in a folder? (owner or admin) */
export async function canGradeAssignment(tx: Tx, user: JWTPayload, assignmentId: string) {
    if (!user.courseId) return null;
    const assignment = await tx.homeworkAssignment.findFirst({
        where: { id: assignmentId, courseId: user.courseId },
        select: { id: true, title: true, teacherUid: true, marksEnabled: true, totalMarks: true },
    });
    if (!assignment) return null;
    const isAdminUser = user.role === "admin" || user.role === "super_admin";
    return isAdminUser || assignment.teacherUid === user.id ? assignment : null;
}
