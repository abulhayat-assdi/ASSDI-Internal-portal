import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/dashboard/notices
 * Returns all staff/general notices.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !user.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = user.courseId;

        const notices = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.notice.findMany({
                where: { courseId },
                orderBy: { createdAt: "desc" }
            })
        );

        return NextResponse.json(notices);
    } catch (error) {
        console.error("Failed to fetch notices:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/dashboard/notices
 * Create a new notice (Admin only)
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const { title, description, date, priority } = body;

        const notice = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.notice.create({
                data: {
                    courseId,
                    title,
                    description,
                    date: date || new Date().toISOString().split('T')[0],
                    priority: priority || "normal",
                    createdBy: user.id,
                    createdByName: user.displayName || "Admin",
                }
            })
        );

        return NextResponse.json(notice);
    } catch (error) {
        console.error("Failed to create notice:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/dashboard/notices?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.notice.delete({ where: { id, courseId } })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Notices DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
