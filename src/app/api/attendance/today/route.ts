export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import { isValidDate, today as todayStr } from "@/lib/attendance";

export interface ScheduledClass {
    batchName: string;
    subject: string;
    teacherName: string;
    time: string;
    /** True once a roll call exists for that batch on that day. */
    attendanceTaken: boolean;
    takenByName: string | null;
}

/**
 * GET /api/attendance/today?date=YYYY-MM-DD
 *
 * The classes the routine says are running on a day, each marked with whether
 * its roll call has been taken yet. This is what turns the attendance screen
 * from "pick a batch, pick a date, type the subject" into a list of today's
 * classes to tap — and it is also how a teacher sees at a glance which batch
 * nobody has called yet.
 *
 * Reads `class_schedules` (the routine). Attendance itself stays keyed to the
 * batch and the day, not to a schedule row, so a class held off-routine can
 * still have its roll call taken.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
        !isAdmin(user) &&
        !hasRequiredPermission(user, "attendance") &&
        !hasRequiredPermission(user, "admin_attendance")
    ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const requested = new URL(req.url).searchParams.get("date");
    const date = requested && isValidDate(requested) ? requested : todayStr();

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const [scheduled, sessions] = await Promise.all([
            tx.classSchedule.findMany({
                where: { courseId, date },
                select: { batch: true, subject: true, teacherName: true, time: true },
                orderBy: [{ time: "asc" }, { batch: "asc" }],
            }),
            tx.attendanceSession.findMany({
                where: { courseId, date },
                select: { batchName: true, takenByName: true },
            }),
        ]);

        const takenBy = new Map(sessions.map((s) => [s.batchName, s.takenByName]));

        // One row per batch: the routine can list several subjects for the
        // same batch on one day, but the roll call is taken once, so the
        // subjects are joined into a single label.
        const byBatch = new Map<string, ScheduledClass>();
        for (const c of scheduled) {
            if (!c.batch) continue;
            const existing = byBatch.get(c.batch);
            if (existing) {
                if (c.subject && !existing.subject.includes(c.subject)) {
                    existing.subject = `${existing.subject}, ${c.subject}`;
                }
                continue;
            }
            byBatch.set(c.batch, {
                batchName: c.batch,
                subject: c.subject ?? "",
                teacherName: c.teacherName ?? "",
                time: c.time ?? "",
                attendanceTaken: takenBy.has(c.batch),
                takenByName: takenBy.get(c.batch) ?? null,
            });
        }

        // A batch whose roll call was taken without being on the routine still
        // belongs in the list, or the screen would claim it is untaken.
        for (const s of sessions) {
            if (!byBatch.has(s.batchName)) {
                byBatch.set(s.batchName, {
                    batchName: s.batchName,
                    subject: "",
                    teacherName: "",
                    time: "",
                    attendanceTaken: true,
                    takenByName: s.takenByName,
                });
            }
        }

        const classes = [...byBatch.values()].sort((a, b) =>
            a.batchName.localeCompare(b.batchName, undefined, { numeric: true })
        );

        return NextResponse.json({
            date,
            classes,
            pending: classes.filter((c) => !c.attendanceTaken).length,
        });
    });
}
