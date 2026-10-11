import type { Prisma } from "@prisma/client";
import type { JWTPayload } from "@/lib/auth";
import { canSubmitForTeam, findGroupForRoll, teamRoleOf, type TeamRole } from "@/lib/competitions";

type Tx = Prisma.TransactionClient;

export interface StudentCompetitionContext {
    roll: string;
    batchName: string;
    name: string;
}

/** The logged-in student's roll/batch/name, read fresh from the DB. */
export async function resolveStudent(tx: Tx, session: JWTPayload, courseId: string): Promise<StudentCompetitionContext | null> {
    const user = await tx.user.findUnique({
        where: { id: session.id },
        select: { displayName: true, studentBatchName: true, studentRoll: true },
    });
    const batchName = user?.studentBatchName || session.studentBatchName || "";
    const roll = user?.studentRoll || session.studentRoll || "";
    if (!batchName || !roll) return null;

    const student = await tx.batchStudent.findUnique({
        where: { courseId_batchName_roll: { courseId, batchName, roll } },
        select: { name: true },
    });
    return { roll, batchName, name: student?.name || user?.displayName || roll };
}

/** The student's team in their batch, and what they are allowed to do in it. */
export async function resolveTeam(tx: Tx, courseId: string, student: StudentCompetitionContext) {
    const groups = await tx.competitionGroup.findMany({
        where: { courseId, batchName: student.batchName },
        orderBy: { groupName: "asc" },
    });
    const group = findGroupForRoll(groups, student.roll);
    const role: TeamRole | null = teamRoleOf(group, student.roll);
    return { group, role, canSubmitTeam: canSubmitForTeam(role) };
}
