export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser } from "@/lib/auth";
import { resolveStudent, resolveTeam } from "@/lib/competitionServer";
import { getDateFieldId, groupMembers, isTeamSubmissionOf, pickSchemaData, validateFormData } from "@/lib/competitions";

// Asks staff to replace an already-submitted day's answers. Nothing changes on
// the submission until the request is approved.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSessionUser();
        if (!session || session.role !== "student" || !session.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = session.courseId;
        const body = await req.json();
        const submissionId = String(body?.submissionId || "");
        const reason = String(body?.reason || "").trim().slice(0, 1000);
        if (!submissionId) return NextResponse.json({ error: "Submission is required" }, { status: 400 });
        if (!reason) return NextResponse.json({ error: "Please explain what needs to be corrected." }, { status: 400 });

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

            const student = await resolveStudent(tx, session, courseId);
            if (!student) return fail("Student profile not found", 403);

            const competition = await tx.competition.findUnique({ where: { id, courseId } });
            if (!competition || competition.batchName !== student.batchName) return fail("Competition not found", 404);

            const submission = await tx.competitionSubmission.findFirst({
                where: { id: submissionId, competitionId: id, courseId },
            });
            if (!submission) return fail("Submission not found", 404);

            const { group, canSubmitTeam } = await resolveTeam(tx, courseId, student);
            const allowed =
                submission.type === "team"
                    ? Boolean(group && canSubmitTeam && isTeamSubmissionOf(submission, group))
                    : submission.rollNumber === student.roll;
            if (!allowed) return fail("You cannot request a correction for this report.", 403);

            const pending = await tx.competitionCorrectionRequest.findFirst({
                where: { courseId, submissionId, status: "pending" },
                select: { id: true },
            });
            if (pending) return fail("A correction request for this date is already waiting for approval.", 409);

            const oldData = (submission.data ?? {}) as Record<string, any>;
            const newData: Record<string, any> = pickSchemaData(competition.schema, body?.data);
            // The report's date is not correctable — it identifies which day this is.
            const dateField = getDateFieldId(competition.schema);
            if (dateField && oldData[dateField] !== undefined) newData[dateField] = oldData[dateField];

            const invalid = validateFormData(competition.schema, newData);
            if (invalid) return fail(invalid, 400);

            if (submission.type === "team") {
                const teamRolls = new Set(groupMembers(group).map((m) => String(m.roll)));
                const absentRolls = (Array.isArray(body?.absentRolls) ? body.absentRolls : [])
                    .map((r: unknown) => String(r))
                    .filter((r: string, i: number, all: string[]) => teamRolls.has(r) && all.indexOf(r) === i);
                newData.absentRolls = absentRolls;
            }

            const sortedRolls = (v: unknown) => (Array.isArray(v) ? v.map(String).sort().join(",") : "");
            const unchanged =
                JSON.stringify(pickSchemaData(competition.schema, newData)) === JSON.stringify(pickSchemaData(competition.schema, oldData)) &&
                sortedRolls(newData.absentRolls) === sortedRolls(oldData.absentRolls);
            if (unchanged) return fail("কোনো পরিবর্তন দেওয়া হয়নি। যে উত্তরটি ঠিক করতে চান তার নতুন মান লিখুন।", 400);

            const request = await tx.competitionCorrectionRequest.create({
                data: {
                    courseId,
                    competitionId: id,
                    submissionId,
                    requesterRoll: student.roll,
                    requesterName: student.name,
                    reason,
                    newData,
                },
            });

            return NextResponse.json({ success: true, id: request.id });
        });
    } catch (error) {
        console.error("Failed to create correction request:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
