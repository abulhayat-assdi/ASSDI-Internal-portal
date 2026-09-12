import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/stats
 * Returns high-level stats for the admin dashboard.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        const courseId = user.courseId;

        const stats = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const [
                totalUsers,
                totalNotices,
                totalResources,
                totalFeedback,
                pendingFeedback,
                pendingClasses
            ] = await Promise.all([
                tx.user.count({ where: { courseId } }),
                tx.notice.count({ where: { courseId } }),
                tx.resource.count({ where: { courseId } }),
                tx.feedback.count({ where: { courseId } }),
                tx.feedback.count({ where: { courseId, status: "PENDING" } }),
                tx.class.count({ where: { courseId, status: "PENDING" } })
            ]);

            return {
                totalUsers,
                totalNotices,
                totalResources,
                totalFeedback,
                pendingFeedback,
                pendingClasses
            };
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error("Failed to fetch admin stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
