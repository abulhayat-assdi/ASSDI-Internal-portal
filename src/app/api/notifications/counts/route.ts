import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/notifications/counts
 * Returns notification counts for the sidebar based on last visited timestamps.
 * Query params: lastVisited_<path>=<timestamp_ms>
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !user.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = user.courseId;

        const { searchParams } = new URL(req.url);
        const role = user.role;

        // Helper to get timestamp from query
        const getTs = (path: string) => {
            const val = searchParams.get(`lastVisited_${path}`);
            return val ? new Date(parseInt(val, 10)) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        };

        const counts = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const counts: Record<string, number> = {};

            // 1. Homework Submissions (Teacher/Admin)
            if (isAdmin(user) || role === "teacher") {
                const ts = getTs("/dashboard/homework");
                const where: any = {
                    courseId,
                    submittedAt: { gt: ts }
                };

                // Teachers only see their own homework
                if (role === "teacher") {
                    where.teacherName = user.displayName;
                }

                counts["/dashboard/homework"] = await tx.homeworkSubmission.count({ where });
            }

            // 2. Admin Manage Homework
            if (isAdmin(user)) {
                const ts = getTs("/dashboard/admin/manage-homework");
                counts["/dashboard/admin/manage-homework"] = await tx.homeworkSubmission.count({
                    where: { courseId, submittedAt: { gt: ts } }
                });
            }

            // 3. Contact Messages / Live Support (Admin & Teachers with access)
            // Uses ChatThread unreadCountAdmin — not legacy ContactMessage table
            if (isAdmin(user) || role === "teacher") {
                const chatUnread = await tx.chatThread.count({
                    where: { courseId, unreadCountAdmin: { gt: 0 } }
                });
                counts["/dashboard/admin/contact-messages"] = chatUnread;
                counts["/dashboard/messages"] = chatUnread;
            }

            // 4. Feedback (Admin only)
            if (isAdmin(user)) {
                const ts = getTs("/dashboard/feedback");
                counts["/dashboard/feedback"] = await tx.feedback.count({
                    where: { courseId, createdAt: { gt: ts } }
                });
            }

            return counts;
        });

        return NextResponse.json({ counts });
    } catch (error) {
        console.error("Failed to fetch notification counts:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
