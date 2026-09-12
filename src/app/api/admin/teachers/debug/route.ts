import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

// GET /api/admin/teachers/debug
// Super-admin only — returns every teacher row exactly as stored in the DB
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const teachers = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.teacher.findMany({
            where: { courseId },
            orderBy: { order: "asc" },
        })
    );

    return NextResponse.json(teachers);
}
