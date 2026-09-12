export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";

/** GET /api/saas/courses/[id]/users — list every user in this course (super_admin only) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: courseId } = await params;

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = 50;

    const where = { courseId, deletedAt: null, ...(role ? { role: role as any } : {}) };

    const { users, total } = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const [users, total] = await Promise.all([
            tx.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                    role: true,
                    studentBatchName: true,
                    studentRoll: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            tx.user.count({ where }),
        ]);
        return { users, total };
    });

    return NextResponse.json({ users, total, page, pages: Math.ceil(total / pageSize) });
}
