import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/quiz/batches — active batches for the quiz audience picker (no typing-exam permission needed). */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const batches = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.batch.findMany({
            where: { courseId, status: "active" },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
        })
    );
    return NextResponse.json({ batches });
}
