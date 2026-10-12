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

/**
 * A competition's products and procurement entries. Entries carry the team's
 * current name, so a renamed team does not split into two in the totals.
 */
export async function loadProcurement(tx: Tx, courseId: string, competition: { id: string; batchName: string }) {
    const [products, rows, groups] = await Promise.all([
        tx.competitionProduct.findMany({ where: { courseId, competitionId: competition.id }, orderBy: { createdAt: "asc" } }),
        tx.competitionProcurement.findMany({
            where: { courseId, competitionId: competition.id },
            orderBy: [{ procuredOn: "desc" }, { createdAt: "desc" }],
            include: { product: { select: { name: true } } },
        }),
        tx.competitionGroup.findMany({
            where: { courseId, batchName: competition.batchName },
            orderBy: { groupName: "asc" },
            select: { id: true, groupName: true, members: true },
        }),
    ]);
    const currentName = new Map(groups.map((g) => [g.id, g.groupName]));
    const entries = rows.map(({ product, ...e }) => ({
        ...e,
        productName: product.name,
        groupName: currentName.get(e.groupId) || e.groupName,
    }));
    return { products, entries, groups };
}
