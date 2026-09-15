export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";

/**
 * GET /api/saas/users — platform-wide user search (super_admin only).
 * Query: email? (contains), role?, courseId?, includeDeleted? (1/0), page?.
 */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim() || undefined;
    const role = searchParams.get("role") || undefined;
    const courseId = searchParams.get("courseId") || undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "1";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = 50;

    const where: Record<string, unknown> = {
        ...(email ? { email: { contains: email.toLowerCase(), mode: "insensitive" } } : {}),
        ...(role ? { role: role as string } : {}),
        ...(courseId ? { courseId } : {}),
        ...(includeDeleted ? {} : { deletedAt: null }),
    };

    const { users, total, courses } = await withCourseContext(
        { courseId: null, isSuperAdmin: true },
        async (tx) => {
            const [users, total, courseRows] = await Promise.all([
                tx.user.findMany({
                    where,
                    select: {
                        id: true, email: true, displayName: true, role: true, courseId: true,
                        studentBatchName: true, studentRoll: true,
                        lastLoginAt: true, createdAt: true, deletedAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                tx.user.count({ where }),
                tx.course.findMany({ select: { id: true, slug: true, name: true } }),
            ]);
            return { users, total, courses: courseRows };
        }
    );

    const courseMap: Record<string, { slug: string; name: string }> = {};
    for (const c of courses) courseMap[c.id] = { slug: c.slug, name: c.name };

    return NextResponse.json({ users, total, page, pages: Math.ceil(total / pageSize), courses: courseMap });
}
