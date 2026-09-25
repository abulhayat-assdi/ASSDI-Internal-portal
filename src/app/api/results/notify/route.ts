export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { notifyStudentsOfResults } from "@/lib/notifications";

const bodySchema = z.object({
    batchName: z.string().min(1),
    examName: z.string().max(120).optional(),
});

/**
 * POST /api/results/notify — tell a batch their results are published.
 *
 * Separate from saving the results grid on purpose: that grid is written row
 * by row while marks are still being entered, so announcing has to be its own
 * deliberate action.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !isTeacherOrAdmin(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: "ব্যাচের নাম দিতে হবে।" }, { status: 400 });
    }
    const { batchName, examName } = parsed.data;

    const batch = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.batch.findFirst({ where: { courseId, name: batchName }, select: { id: true } })
    );
    if (!batch) return NextResponse.json({ error: "ব্যাচ পাওয়া যায়নি।" }, { status: 404 });

    notifyStudentsOfResults({ courseId, batchName, examName: examName || null });

    return NextResponse.json({ success: true });
}
