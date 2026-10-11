export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import { isValidDate } from "@/lib/attendance";

/**
 * GET /api/attendance/leaves?batchName=&date=
 *
 * Ids of the batch's students who have an APPROVED leave covering `date`.
 * The roll-call screen pre-marks them "On Leave"; the teacher can still
 * override any of them to Present / Absent / Late.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (
        !user ||
        !user.courseId ||
        !(isAdmin(user) || hasRequiredPermission(user, "attendance") || hasRequiredPermission(user, "admin_attendance"))
    ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get("batchName");
    const date = searchParams.get("date");
    if (!batchName || !isValidDate(date)) {
        return NextResponse.json({ error: "batchName and date (YYYY-MM-DD) are required" }, { status: 400 });
    }

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const leaves = await tx.studentLeaveRequest.findMany({
            where: {
                courseId,
                studentBatchName: batchName,
                status: "APPROVED",
                startDate: { lte: date },
                endDate: { gte: date },
            },
            select: { studentRoll: true },
        });
        if (leaves.length === 0) return NextResponse.json({ studentIds: [] });

        const students = await tx.batchStudent.findMany({
            where: { courseId, batchName, roll: { in: leaves.map((l) => l.studentRoll) } },
            select: { id: true },
        });
        return NextResponse.json({ studentIds: students.map((s) => s.id) });
    });
}
