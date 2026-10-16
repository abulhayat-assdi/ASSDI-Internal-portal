export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { classLogAccess } from "@/lib/teacherClassLogAuth";
import { isValidDateString } from "@/lib/teacherClassLog";

/**
 * GET /api/teacher-class-logs/summary?from=&to=&teacherUid=&batchName=&subjectId=
 * How many classes each teacher took and for how long. Admin / Super Admin only.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || classLogAccess(user) !== "all") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const teacherUid = searchParams.get("teacherUid");
    const batchName = searchParams.get("batchName");
    const subjectId = searchParams.get("subjectId");
    if ((from && !isValidDateString(from)) || (to && !isValidDateString(to))) {
        return NextResponse.json({ error: "তারিখ সঠিক নয়।" }, { status: 400 });
    }

    const logs = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.teacherClassLog.findMany({
            where: {
                courseId,
                ...(teacherUid ? { teacherUid } : {}),
                ...(batchName ? { batchName } : {}),
                ...(subjectId ? { subjectId } : {}),
                ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
            },
            select: { teacherUid: true, teacherName: true, date: true, durationMin: true },
        })
    );

    const byTeacher = new Map<string, { teacherUid: string; teacherName: string; classes: number; totalMinutes: number; days: Set<string> }>();
    for (const l of logs) {
        const row = byTeacher.get(l.teacherUid) ?? {
            teacherUid: l.teacherUid,
            teacherName: l.teacherName,
            classes: 0,
            totalMinutes: 0,
            days: new Set<string>(),
        };
        row.classes += 1;
        row.totalMinutes += l.durationMin;
        row.days.add(l.date);
        byTeacher.set(l.teacherUid, row);
    }

    const teachers = [...byTeacher.values()]
        .map(({ days, ...row }) => ({ ...row, activeDays: days.size }))
        .sort((a, b) => b.totalMinutes - a.totalMinutes || a.teacherName.localeCompare(b.teacherName));

    return NextResponse.json({
        teachers,
        totals: {
            teachers: teachers.length,
            classes: logs.length,
            totalMinutes: logs.reduce((n, l) => n + l.durationMin, 0),
        },
    });
}
