import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ClassStatus, ScheduleStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PATCH /api/schedule/complete — mark a class schedule entry as completed (by id) */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, status } = body;

        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

        const schedule = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.classSchedule.update({
                where: { id, courseId },
                data: { status: status || "Completed" },
            })
        );

        return NextResponse.json(schedule);
    } catch (error) {
        console.error("[Schedule Complete PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/schedule/complete
 * Body: { teacherId, teacherName, scheduleItem, action: "complete" | "request" }
 *
 * action "complete" → ClassSchedule.status = Completed, Class.status = COMPLETED
 * action "request"  → ClassSchedule.status = Requested, Class.status = REQUEST_TO_COMPLETE
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { teacherId, teacherName, scheduleItem, action } = body;

        if (!scheduleItem?.id || !action) {
            return NextResponse.json({ error: "scheduleItem.id and action are required" }, { status: 400 });
        }

        const isComplete = action === "complete";
        const scheduleStatus: ScheduleStatus = isComplete ? ScheduleStatus.Completed : ScheduleStatus.Requested;
        const classStatus: ClassStatus = isComplete ? ClassStatus.COMPLETED : ClassStatus.REQUEST_TO_COMPLETE;

        await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // 1. Update ClassSchedule status
            await tx.classSchedule.update({
                where: { id: scheduleItem.id, courseId },
                data: { status: scheduleStatus },
            });

            // 2. Upsert Class record (prevent duplicate counts for same class session)
            const existing = await tx.class.findFirst({
                where: {
                    courseId,
                    teacherUid: teacherId || user.id,
                    date: scheduleItem.date || "",
                    batch: scheduleItem.batch || "",
                    subject: scheduleItem.subject || "",
                },
            });

            if (existing) {
                await tx.class.update({
                    where: { id: existing.id },
                    data: {
                        status: classStatus,
                        completedByUid: isComplete ? (teacherId || user.id) : existing.completedByUid,
                        completedAt: isComplete ? new Date() : existing.completedAt,
                    },
                });
            } else {
                await tx.class.create({
                    data: {
                        courseId,
                        teacherUid: teacherId || user.id,
                        teacherName: teacherName || user.displayName || "",
                        date: scheduleItem.date || "",
                        startTime: scheduleItem.time || "",
                        endTime: "",
                        batch: scheduleItem.batch || "",
                        subject: scheduleItem.subject || "",
                        status: classStatus,
                        completedByUid: isComplete ? (teacherId || user.id) : null,
                        completedAt: isComplete ? new Date() : null,
                    },
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Schedule Complete POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
