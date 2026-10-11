export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser } from "@/lib/auth";
import { resolveStudent, resolveTeam } from "@/lib/competitionServer";

// Competitions running for the logged-in student's own batch.
export async function GET() {
    try {
        const session = await getServerSessionUser();
        if (!session || session.role !== "student" || !session.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = session.courseId;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const student = await resolveStudent(tx, session, courseId);
            if (!student) return NextResponse.json({ competitions: [], team: null });

            const [competitions, team] = await Promise.all([
                tx.competition.findMany({
                    where: { courseId, batchName: student.batchName },
                    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
                    select: { id: true, title: true, description: true, batchName: true, isActive: true, startDate: true, endDate: true },
                }),
                resolveTeam(tx, courseId, student),
            ]);

            return NextResponse.json({
                competitions,
                team: team.group ? { groupName: team.group.groupName, role: team.role } : null,
            });
        });
    } catch (error) {
        console.error("Failed to fetch student competitions:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
