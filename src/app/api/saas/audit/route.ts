export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";

/**
 * GET /api/saas/audit — platform-wide activity log (super_admin only).
 * Query: courseId?, actionType?, q? (matches description/targetId/actorUid),
 *        page? (50 per page). ActorRole enum has no SUPER_ADMIN variant, so
 * super-admin actions are logged as ADMIN with the email in the description.
 */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId") || undefined;
    const actionType = searchParams.get("actionType") || undefined;
    const q = searchParams.get("q")?.trim() || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = 50;

    const where: Record<string, unknown> = {
        ...(courseId ? { courseId } : {}),
        ...(actionType ? { actionType } : {}),
        ...(q
            ? {
                OR: [
                    { description: { contains: q, mode: "insensitive" } },
                    { targetId: { contains: q } },
                    { actorUid: { contains: q } },
                ],
            }
            : {}),
    };

    const { logs, total, courses, actionTypes } = await withCourseContext(
        { courseId: null, isSuperAdmin: true },
        async (tx) => {
            const [logs, total, courseRows, actionRows] = await Promise.all([
                tx.activityLog.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                tx.activityLog.count({ where }),
                tx.course.findMany({ select: { id: true, slug: true, name: true } }),
                tx.activityLog.groupBy({ by: ["actionType"], _count: { actionType: true } }),
            ]);
            return {
                logs,
                total,
                courses: courseRows,
                actionTypes: actionRows
                    .map((r) => r.actionType)
                    .sort(),
            };
        }
    );

    const courseMap: Record<string, { slug: string; name: string }> = {};
    for (const c of courses) courseMap[c.id] = { slug: c.slug, name: c.name };

    return NextResponse.json({ logs, total, page, pages: Math.ceil(total / pageSize), courses: courseMap, actionTypes });
}
