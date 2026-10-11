export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser } from "@/lib/auth";
import { resolveStudent, resolveTeam } from "@/lib/competitionServer";
import { effectiveReportDate, getDateFieldId, groupMembers, isTeamSubmissionOf, toReportDate } from "@/lib/competitions";

// The form plus everything this student is allowed to see: their own
// individual reports, their teammates' individual reports, and their team's
// reports. Nothing from other teams ever leaves the server.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSessionUser();
        if (!session || session.role !== "student" || !session.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = session.courseId;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const student = await resolveStudent(tx, session, courseId);
            if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 403 });

            const competition = await tx.competition.findUnique({ where: { id, courseId } });
            if (!competition || competition.batchName !== student.batchName) {
                return NextResponse.json({ error: "Competition not found" }, { status: 404 });
            }

            const { group, role, canSubmitTeam } = await resolveTeam(tx, courseId, student);
            const members = groupMembers(group);
            const teamRolls = members.map((m) => String(m.roll));
            const visibleRolls = Array.from(new Set([student.roll, ...teamRolls]));

            const rows = await tx.competitionSubmission.findMany({
                where: {
                    courseId,
                    competitionId: id,
                    OR: [
                        { type: "individual", rollNumber: { in: visibleRolls } },
                        ...(group ? [{ type: "team" }] : []),
                    ],
                },
                orderBy: { submittedAt: "desc" },
            });

            const submissions = rows
                .filter((s) => s.type !== "team" || (group && isTeamSubmissionOf(s, group)))
                .map((s) => {
                    const isTeam = s.type === "team";
                    const mine = !isTeam && s.rollNumber === student.roll;
                    return {
                        id: s.id,
                        type: s.type,
                        scope: isTeam ? "team" : mine ? "mine" : "teammate",
                        rollNumber: s.rollNumber,
                        studentName: s.studentName,
                        data: s.data,
                        reportDate: effectiveReportDate(s, competition.schema),
                        submittedAt: s.submittedAt,
                        canRequestCorrection: isTeam ? canSubmitTeam : mine,
                    };
                });

            const visibleIds = submissions.map((s) => s.id);
            const corrections = visibleIds.length
                ? await tx.competitionCorrectionRequest.findMany({
                      where: { courseId, competitionId: id, submissionId: { in: visibleIds } },
                      orderBy: { createdAt: "desc" },
                  })
                : [];
            // Teammates' individual correction requests stay private to them.
            const ownOrTeam = new Set(submissions.filter((s) => s.scope !== "teammate").map((s) => s.id));

            return NextResponse.json({
                competition: {
                    id: competition.id,
                    title: competition.title,
                    description: competition.description,
                    batchName: competition.batchName,
                    schema: competition.schema,
                    isActive: competition.isActive,
                },
                me: { roll: student.roll, name: student.name },
                team: group ? { id: group.id, groupName: group.groupName, members, role, canSubmitTeam } : null,
                today: toReportDate(),
                dateFieldId: getDateFieldId(competition.schema),
                submissions,
                corrections: corrections.filter((c) => ownOrTeam.has(c.submissionId)),
            });
        });
    } catch (error) {
        console.error("Failed to fetch student competition:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
