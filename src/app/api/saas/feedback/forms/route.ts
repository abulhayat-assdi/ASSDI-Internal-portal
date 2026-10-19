import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/saas/feedback/forms — super_admin only: the feedback "folders" (one per form) */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = new URL(req.url).searchParams.get("courseId");

    const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const forms = await tx.feedbackForm.findMany({
            where: courseId ? { courseId } : {},
            include: { course: { select: { id: true, slug: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });
        const counts = await tx.feedback.groupBy({
            by: ["formId"],
            where: courseId ? { courseId } : {},
            _count: { _all: true },
        });
        const countFor = (id: string | null) => counts.find((c) => c.formId === id)?._count._all ?? 0;
        return {
            generalCount: countFor(null),
            forms: forms.map((f) => ({ ...f, total: countFor(f.id) })),
        };
    });

    return NextResponse.json(result);
}
