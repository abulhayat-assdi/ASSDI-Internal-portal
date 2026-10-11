import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/leave-status?batch=<name>&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Read-only "who is on leave" view for every teacher/admin. Only approved
 * leaves are returned and only the fields a teacher needs (name, phone,
 * reason, dates) — no review status, notes or attachments. Reviewing leave
 * requests stays behind the `admin_leave` permission.
 *
 * `batch` is optional (omit for all batches). `from`/`to` default to today.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batch = searchParams.get("batch")?.trim() || null;
    const from = searchParams.get("from")?.trim() || "";
    const to = searchParams.get("to")?.trim() || from;

    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
        return NextResponse.json({ error: "from/to must be YYYY-MM-DD dates" }, { status: 400 });
    }
    if (from > to) {
        return NextResponse.json({ error: "'from' date cannot be after 'to' date" }, { status: 400 });
    }

    // Dates are stored as ISO strings, so lexicographic comparison is
    // chronological. A leave overlaps [from, to] when it starts on/before
    // `to` and ends on/after `from`.
    const leaves = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.studentLeaveRequest.findMany({
            where: {
                courseId,
                status: "APPROVED",
                ...(batch ? { studentBatchName: batch } : {}),
                startDate: { lte: to },
                endDate: { gte: from },
            },
            orderBy: [{ studentBatchName: "asc" }, { startDate: "asc" }],
            select: {
                id: true,
                studentName: true,
                studentRoll: true,
                studentPhone: true,
                studentBatchName: true,
                startDate: true,
                endDate: true,
                reason: true,
            },
        })
    );

    leaves.sort(
        (a, b) =>
            a.studentBatchName.localeCompare(b.studentBatchName, undefined, { numeric: true, sensitivity: "base" }) ||
            a.studentRoll.localeCompare(b.studentRoll, undefined, { numeric: true, sensitivity: "base" })
    );

    return NextResponse.json({ leaves });
}
