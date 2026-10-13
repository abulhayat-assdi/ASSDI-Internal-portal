import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive day count between two ISO dates (UTC math, so no DST drift). */
function inclusiveDays(start: string, end: string): number {
    const s = Date.parse(`${start}T00:00:00Z`);
    const e = Date.parse(`${end}T00:00:00Z`);
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
    return Math.round((e - s) / 86400000) + 1;
}

/**
 * GET /api/leave-status?batch=<name>&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Read-only "who is on leave" view for every teacher/admin. Only approved
 * leaves are returned and only the fields a teacher needs (name, phone,
 * reason, dates) — no review status, notes or attachments. Reviewing leave
 * requests stays behind the `admin_leave` permission.
 *
 * `batch` is optional and may repeat (omit for all batches). `from`/`to` default to today.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchNames = searchParams.getAll("batch").map((b) => b.trim()).filter(Boolean);
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
    const { leaves, history } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const leaves = await tx.studentLeaveRequest.findMany({
            where: {
                courseId,
                status: "APPROVED",
                ...(batchNames.length ? { studentBatchName: { in: batchNames } } : {}),
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
        });

        // Counts only — how often each of these students has taken approved
        // leave in total (no reasons), so a teacher can spot a pattern.
        const history = new Map<string, { count: number; days: number }>();
        if (leaves.length > 0) {
            const past = await tx.studentLeaveRequest.findMany({
                where: {
                    courseId,
                    status: "APPROVED",
                    studentBatchName: { in: [...new Set(leaves.map((l) => l.studentBatchName))] },
                    studentRoll: { in: [...new Set(leaves.map((l) => l.studentRoll))] },
                },
                select: { studentBatchName: true, studentRoll: true, startDate: true, endDate: true },
            });
            for (const p of past) {
                const key = `${p.studentBatchName}::${p.studentRoll}`;
                const h = history.get(key) ?? { count: 0, days: 0 };
                h.count += 1;
                h.days += inclusiveDays(p.startDate, p.endDate);
                history.set(key, h);
            }
        }
        return { leaves, history };
    });

    leaves.sort(
        (a, b) =>
            a.studentBatchName.localeCompare(b.studentBatchName, undefined, { numeric: true, sensitivity: "base" }) ||
            a.studentRoll.localeCompare(b.studentRoll, undefined, { numeric: true, sensitivity: "base" })
    );

    return NextResponse.json({
        leaves: leaves.map((l) => {
            const h = history.get(`${l.studentBatchName}::${l.studentRoll}`);
            return { ...l, totalLeaves: h?.count ?? 1, totalLeaveDays: h?.days ?? inclusiveDays(l.startDate, l.endDate) };
        }),
    });
}
