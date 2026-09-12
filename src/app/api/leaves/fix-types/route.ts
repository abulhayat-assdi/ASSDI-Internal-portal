import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/leaves/fix-types
 * One-time fix: update leaves with reason="Auto-generated weekly holiday"
 * that have type="Other" → change to type="WeeklyHoliday"
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.leave.updateMany({
                where: {
                    courseId,
                    reason: "Auto-generated weekly holiday",
                    type: "Other",
                },
                data: { type: "WeeklyHoliday" },
            })
        );

        return NextResponse.json({ fixed: result.count });
    } catch (error) {
        console.error("[Leaves FixTypes]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
