export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";

/**
 * GET /api/attendance/teachers — who may be recorded as taking a roll call.
 *
 * Names and ids only. The attendance screen tends to live on a shared device,
 * so this list is visible to anyone who can reach that screen; email
 * addresses are deliberately not part of it.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
        !isAdmin(user) &&
        !hasRequiredPermission(user, "attendance") &&
        !hasRequiredPermission(user, "admin_attendance")
    ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const teachers = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.user.findMany({
            where: { courseId, role: { in: ["teacher", "admin"] }, deletedAt: null },
            select: { id: true, displayName: true, role: true },
            orderBy: { displayName: "asc" },
        })
    );

    return NextResponse.json({ teachers });
}
