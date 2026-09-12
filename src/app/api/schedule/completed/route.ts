import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/schedule/completed?batch=Batch_09
 * Returns Class records (completed / requested) for a given batch.
 * Used by the CSV export feature.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batch = searchParams.get("batch");

    if (!batch) {
        return NextResponse.json({ error: "batch query param required" }, { status: 400 });
    }

    try {
        const classes = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.class.findMany({
                where: { courseId, batch },
                orderBy: { date: "asc" },
            })
        );

        // Map to the FirestoreClass shape the client expects
        const result = classes.map(c => ({
            id: c.id,
            teacherUid: c.teacherUid,
            teacherName: c.teacherName,
            date: c.date,
            startTime: c.startTime,
            endTime: c.endTime,
            batch: c.batch,
            subject: c.subject,
            status: c.status,
            completedByUid: c.completedByUid ?? null,
            completedAt: c.completedAt ? c.completedAt.toISOString() : null,
            createdAt: c.createdAt ? c.createdAt.toISOString() : null,
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error("[schedule/completed GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
