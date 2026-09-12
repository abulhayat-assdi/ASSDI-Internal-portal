import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/dashboard/monthly-stats?teacherId=... */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId") || user.teacherId || user.id;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthPrefix = `${year}-${month}`;

    const { total, completed, pending } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const [total, completed, pending] = await Promise.all([
            tx.class.count({ where: { courseId, teacherUid: teacherId, date: { startsWith: monthPrefix } } }),
            tx.class.count({ where: { courseId, teacherUid: teacherId, date: { startsWith: monthPrefix }, status: "COMPLETED" } }),
            tx.class.count({ where: { courseId, teacherUid: teacherId, date: { startsWith: monthPrefix }, status: "PENDING" } }),
        ]);
        return { total, completed, pending };
    });

    return NextResponse.json({ total, completed, pending });
}
