export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { LOW_ATTENDANCE_THRESHOLD, emptyTally, tally } from "@/lib/attendance";

/**
 * GET /api/attendance/me — the signed-in student's own attendance.
 *
 * Scoped to the batch and roll on the session, never to an id from the
 * query string, so one student cannot read another's record.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || user.role !== "student") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { studentBatchName, studentRoll } = user;

    if (!studentBatchName || !studentRoll) {
        return NextResponse.json({ tally: emptyTally(), entries: [], threshold: LOW_ATTENDANCE_THRESHOLD });
    }

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const student = await tx.batchStudent.findUnique({
            where: { courseId_batchName_roll: { courseId, batchName: studentBatchName, roll: studentRoll } },
            select: { id: true },
        });
        if (!student) {
            return NextResponse.json({ tally: emptyTally(), entries: [], threshold: LOW_ATTENDANCE_THRESHOLD });
        }

        const records = await tx.attendanceRecord.findMany({
            where: { courseId, studentId: student.id },
            select: {
                status: true,
                note: true,
                session: { select: { date: true, subject: true } },
            },
        });

        const entries = records
            .map((r) => ({
                date: r.session.date,
                subject: r.session.subject,
                status: r.status,
                note: r.note,
            }))
            .sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({
            tally: tally(records.map((r) => r.status)),
            entries,
            threshold: LOW_ATTENDANCE_THRESHOLD,
        });
    });
}
