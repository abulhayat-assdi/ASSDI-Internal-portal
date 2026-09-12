import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/pending-classes
 * Returns all classes with PENDING status for admin review.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        const courseId = user.courseId;

        const pendingClasses = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.class.findMany({
                where: { courseId, status: "PENDING" },
                orderBy: { date: "asc" }
            })
        );

        return NextResponse.json(pendingClasses);
    } catch (error) {
        console.error("Failed to fetch pending classes:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
