import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/schedule/sync
 * Bulk upsert schedule entries — syncs a teacher's schedule for a date range.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { schedules, teacherId, deleteExisting } = body;

        if (!Array.isArray(schedules)) {
            return NextResponse.json({ error: "schedules array required" }, { status: 400 });
        }

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            if (deleteExisting && teacherId) {
                await tx.classSchedule.deleteMany({ where: { courseId, teacherId } });
            }

            return tx.classSchedule.createMany({
                data: schedules.map((s: any) => ({
                    courseId,
                    teacherId: s.teacherId || teacherId || user.id,
                    teacherName: s.teacherName || user.displayName,
                    date: s.date || "",
                    day: s.day || "",
                    batch: s.batch || "",
                    subject: s.subject || "",
                    time: s.time || "",
                    status: s.status || "Scheduled",
                })),
                skipDuplicates: true,
            });
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error("[Schedule Sync]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
