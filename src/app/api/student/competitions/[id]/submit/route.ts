export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser } from "@/lib/auth";
import { resolveStudent, resolveTeam } from "@/lib/competitionServer";
import {
    effectiveReportDate,
    formatReportDate,
    getDateFieldId,
    groupMembers,
    isTeamSubmissionOf,
    isValidReportDate,
    pickSchemaData,
    toReportDate,
    validateFormData,
} from "@/lib/competitions";

// Files one report. Who is reporting — roll, name and team — always comes from
// the session, never from the request body.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSessionUser();
        if (!session || session.role !== "student" || !session.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = session.courseId;
        const body = await req.json();
        const type = body?.type === "team" ? "team" : "individual";

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

            const student = await resolveStudent(tx, session, courseId);
            if (!student) return fail("Student profile not found", 403);

            const competition = await tx.competition.findUnique({ where: { id, courseId } });
            if (!competition || competition.batchName !== student.batchName) return fail("Competition not found", 404);
            if (!competition.isActive) return fail("This competition is no longer accepting reports.", 400);

            const { group, canSubmitTeam } = await resolveTeam(tx, courseId, student);
            if (type === "team") {
                if (!group) return fail("You are not in any team yet. Please contact your teacher.", 403);
                if (!canSubmitTeam) return fail("Only the team leader or deputy leader can submit the team report.", 403);
            }

            const data: Record<string, any> = pickSchemaData(competition.schema, body?.data);
            const invalid = validateFormData(competition.schema, data);
            if (invalid) return fail(invalid, 400);

            const dateField = getDateFieldId(competition.schema);
            const answeredDate = dateField ? data[dateField] : null;
            const reportDate = isValidReportDate(answeredDate) ? answeredDate : body?.reportDate;
            if (!isValidReportDate(reportDate)) return fail("Please select the report date.", 400);
            if (reportDate > toReportDate()) return fail("You cannot submit a report for a future date.", 400);

            // Serialise same-day submits (a double click, or leader and deputy at
            // the same moment) so the duplicate check below cannot be raced.
            const lockKey = `competition-report:${id}:${type === "team" ? group!.id : student.roll}:${reportDate}`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

            // One report per day: per team for team reports, per student for individual ones.
            const existing = await tx.competitionSubmission.findMany({
                where: {
                    courseId,
                    competitionId: id,
                    type,
                    ...(type === "individual" ? { rollNumber: student.roll } : {}),
                },
            });
            const duplicate = existing.some(
                (s) =>
                    (type === "individual" || isTeamSubmissionOf(s, group!)) &&
                    effectiveReportDate(s, competition.schema) === reportDate
            );
            if (duplicate) {
                return fail(
                    `${formatReportDate(reportDate)} তারিখে একবার জমা দেওয়া হয়েছে, তাই আবার জমা দেওয়া যাবে না। ভুল থাকলে Correction Request পাঠান।`,
                    409
                );
            }

            if (type === "team") {
                const teamRolls = new Set(groupMembers(group).map((m) => String(m.roll)));
                const absentRolls = (Array.isArray(body?.absentRolls) ? body.absentRolls : [])
                    .map((r: unknown) => String(r))
                    .filter((r: string, i: number, all: string[]) => teamRolls.has(r) && r !== student.roll && all.indexOf(r) === i);
                if (absentRolls.length > 0) data.absentRolls = absentRolls;
            }

            const submission = await tx.competitionSubmission.create({
                data: {
                    courseId,
                    competitionId: id,
                    type,
                    // Individual rows keep teamName empty: reports treat any row with a
                    // team name as a team report. groupId still records the team.
                    teamName: type === "team" ? group!.groupName : null,
                    groupId: group?.id ?? null,
                    rollNumber: student.roll,
                    studentName: student.name,
                    reportDate,
                    data,
                },
            });

            return NextResponse.json({ success: true, id: submission.id });
        });
    } catch (error) {
        console.error("Failed to submit competition report:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
