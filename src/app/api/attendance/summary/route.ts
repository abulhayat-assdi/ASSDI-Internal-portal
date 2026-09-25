export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import type { AttendanceStatus } from "@prisma/client";
import { LOW_ATTENDANCE_THRESHOLD, isLowAttendance, tally, type AttendanceTally } from "@/lib/attendance";

export interface StudentAttendanceSummary {
    studentId: string;
    roll: string;
    name: string;
    batchName: string;
    tally: AttendanceTally;
    low: boolean;
}

/**
 * GET /api/attendance/summary?batchName=&from=&to=&threshold=
 *
 * Per-student totals for the report screen. Rolls the records up in memory
 * rather than in SQL because a course is a few hundred students over a few
 * hundred classes — small enough that one indexed read beats a groupBy plus
 * a second query to name the rows.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(user) && !hasRequiredPermission(user, "admin_attendance") && !hasRequiredPermission(user, "attendance")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get("batchName");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const thresholdRaw = Number(searchParams.get("threshold"));
    const threshold =
        Number.isFinite(thresholdRaw) && thresholdRaw > 0 && thresholdRaw <= 100
            ? thresholdRaw
            : LOW_ATTENDANCE_THRESHOLD;

    const dateFilter =
        from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const sessions = await tx.attendanceSession.findMany({
            where: { courseId, ...(batchName ? { batchName } : {}), ...dateFilter },
            select: { id: true, date: true, batchName: true },
        });
        const sessionIds = sessions.map((s) => s.id);

        // Students first, so somebody who has never been marked still shows up
        // with an empty row instead of quietly vanishing from the report.
        const students = await tx.batchStudent.findMany({
            where: { courseId, ...(batchName ? { batchName } : {}), courseStatus: "Running" },
            select: { id: true, roll: true, name: true, batchName: true },
        });

        const records = sessionIds.length
            ? await tx.attendanceRecord.findMany({
                  where: { courseId, sessionId: { in: sessionIds } },
                  select: { studentId: true, status: true },
              })
            : [];

        const byStudent = new Map<string, AttendanceStatus[]>();
        for (const r of records) {
            const list = byStudent.get(r.studentId);
            if (list) list.push(r.status);
            else byStudent.set(r.studentId, [r.status]);
        }

        const summaries: StudentAttendanceSummary[] = students
            .map((s) => {
                const t = tally(byStudent.get(s.id) ?? []);
                return {
                    studentId: s.id,
                    roll: s.roll,
                    name: s.name,
                    batchName: s.batchName,
                    tally: t,
                    low: isLowAttendance(t, threshold),
                };
            })
            .sort(
                (a, b) =>
                    a.batchName.localeCompare(b.batchName, undefined, { numeric: true }) ||
                    a.roll.localeCompare(b.roll, undefined, { numeric: true })
            );

        const measured = summaries.filter((s) => s.tally.percentage !== null);
        const courseAverage = measured.length
            ? Math.round((measured.reduce((sum, s) => sum + s.tally.percentage!, 0) / measured.length) * 10) / 10
            : null;

        return NextResponse.json({
            summaries,
            threshold,
            totals: {
                sessions: sessions.length,
                students: summaries.length,
                lowCount: summaries.filter((s) => s.low).length,
                courseAverage,
            },
        });
    });
}
