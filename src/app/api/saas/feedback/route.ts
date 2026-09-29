import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CATEGORIES = ["CourseContent", "Teacher", "Facilities", "Administration", "Other"] as const;

/**
 * GET /api/saas/feedback — super_admin only: every course's feedback, with
 * the submitting student's identity included. Every other role only ever
 * sees the anonymized shape from /api/feedback.
 */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const category = searchParams.get("category");
    const readParam = searchParams.get("isRead");

    const items = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.feedback.findMany({
            where: {
                ...(courseId ? { courseId } : {}),
                ...(category && CATEGORIES.includes(category as any) ? { category: category as any } : {}),
                ...(readParam === "true" ? { isRead: true } : readParam === "false" ? { isRead: false } : {}),
            },
            include: { course: { select: { id: true, slug: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 500,
        })
    );

    return NextResponse.json(items);
}
