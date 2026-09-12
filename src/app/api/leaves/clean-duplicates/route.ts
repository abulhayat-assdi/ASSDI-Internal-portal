import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/leaves/clean-duplicates
 * Removes duplicate WeeklyHoliday entries for a teacher in a given month.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { teacherId, monthYear } = body;

        if (!teacherId || !monthYear) {
            return NextResponse.json({ error: "teacherId and monthYear required" }, { status: 400 });
        }

        const deleted = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const leaves = await tx.leave.findMany({
                where: { courseId, teacherId, monthYear, type: "WeeklyHoliday" },
                orderBy: { createdAt: "asc" },
            });

            const seen = new Set<string>();
            const toDelete: string[] = [];

            for (const leave of leaves) {
                const key = `${leave.startDate}`;
                if (seen.has(key)) {
                    toDelete.push(leave.id);
                } else {
                    seen.add(key);
                }
            }

            if (toDelete.length > 0) {
                await tx.leave.deleteMany({ where: { courseId, id: { in: toDelete } } });
            }

            return toDelete.length;
        });

        return NextResponse.json({ deleted });
    } catch (error) {
        console.error("[Leaves CleanDuplicates]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
