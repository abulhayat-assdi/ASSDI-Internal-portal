import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/mark-class-complete
 * Marks a class as COMPLETED in PostgreSQL.
 * If the class doesn't exist (e.g. it was a virtual sheet class), it creates it.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const { classId, clsData } = body;

        if (!classId) {
            return NextResponse.json({ error: "Class ID is required" }, { status: 400 });
        }

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            let cls;

            if (classId.startsWith('sheet_')) {
                // Create a new record for a virtual sheet class
                cls = await tx.class.create({
                    data: {
                        courseId,
                        teacherUid: clsData.teacherUid,
                        teacherName: clsData.teacherName,
                        date: clsData.date,
                        startTime: clsData.startTime || "",
                        endTime: clsData.endTime || "",
                        timeRange: clsData.timeRange || "",
                        batch: clsData.batch,
                        subject: clsData.subject,
                        status: "COMPLETED",
                        completedByUid: user.id,
                        completedAt: new Date(),
                    }
                });
            } else {
                // Update existing class
                cls = await tx.class.update({
                    where: { id: classId, courseId },
                    data: {
                        status: "COMPLETED",
                        completedByUid: user.id,
                        completedAt: new Date(),
                    }
                });
            }

            // Log Activity
            await tx.activityLog.create({
                data: {
                    courseId,
                    actorUid: user.id,
                    actorRole: "ADMIN",
                    actionType: "CLASS_COMPLETED",
                    targetType: "class",
                    targetId: cls.id,
                    description: `Admin marked class '${cls.subject}' for '${cls.batch}' as completed`,
                }
            });

            return cls;
        });

        return NextResponse.json({ success: true, class: result });
    } catch (error) {
        console.error("Failed to mark class as complete:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
