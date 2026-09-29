import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CATEGORIES = ["CourseContent", "Teacher", "Facilities", "Administration", "Other"] as const;

// Fields shared with every teacher/admin in the course — student identity
// (studentUid/studentName/studentRoll) is never selected here. Only a
// genuine super_admin session (see /api/saas/feedback) can see who wrote it.
const ANONYMIZED_SELECT = {
    id: true,
    batchName: true,
    category: true,
    message: true,
    rating: true,
    isRead: true,
    createdAt: true,
} as const;

/** GET /api/feedback — teacher/admin: anonymized feedback for their course */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const readParam = searchParams.get("isRead");
    // Defaults to running batches only, matching the roll-call convention.
    const allBatches = searchParams.get("allBatches") === "true";

    const items = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.feedback.findMany({
            where: {
                courseId,
                ...(category && CATEGORIES.includes(category as any) ? { category: category as any } : {}),
                ...(readParam === "true" ? { isRead: true } : readParam === "false" ? { isRead: false } : {}),
                ...(allBatches ? {} : { batch: { status: "active" } }),
            },
            select: ANONYMIZED_SELECT,
            orderBy: { createdAt: "desc" },
        })
    );

    return NextResponse.json(items);
}

/** PATCH /api/feedback — mark a feedback item read/unread */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, isRead } = body;
        if (!id || typeof isRead !== "boolean") {
            return NextResponse.json({ error: "id and isRead are required" }, { status: 400 });
        }

        const item = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.feedback.update({
                where: { id, courseId },
                data: isRead
                    ? { isRead: true, readByUid: user.id, readAt: new Date() }
                    : { isRead: false, readByUid: null, readAt: null },
                select: ANONYMIZED_SELECT,
            })
        );

        return NextResponse.json(item);
    } catch (error) {
        console.error("[Feedback PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/feedback?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.feedback.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}
