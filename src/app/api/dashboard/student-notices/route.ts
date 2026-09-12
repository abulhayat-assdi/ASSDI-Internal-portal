import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/dashboard/student-notices
 * Returns all notices targeted at students.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !user.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = user.courseId;

        const notices = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.studentNotice.findMany({
                where: { courseId },
                orderBy: { createdAt: "desc" }
            })
        );

        return NextResponse.json(notices);
    } catch (error) {
        console.error("Failed to fetch student notices:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/dashboard/student-notices
 * Create a new student notice (Admin/Teacher only)
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || (user.role !== "admin" && user.role !== "teacher") || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const { title, description, date, priority } = body;

        const notice = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.studentNotice.create({
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
        console.error("Failed to create student notice:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/dashboard/student-notices?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || (user.role !== "admin" && user.role !== "teacher") || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.studentNotice.delete({ where: { id, courseId } })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Student-notices DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
