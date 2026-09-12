import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getCurrentWeekRange = () => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
    const dayOfWeek = today.getDay();
    // Week: Saturday → Friday (same logic as client-side service)
    const diffToFriday = (dayOfWeek + 2) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - diffToFriday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { start: fmt(start), end: fmt(end) };
};

/**
 * GET /api/schedule/all
 * Returns all ClassSchedule records.
 * Without ?all=true  → filters to current Sat–Fri week.
 * With    ?all=true  → returns everything (no date filter).
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    const where: Record<string, unknown> = { courseId };
    if (!all) {
        const { start, end } = getCurrentWeekRange();
        where.date = { gte: start, lte: end };
    }

    try {
        const schedules = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.classSchedule.findMany({
                where,
                orderBy: [{ date: "asc" }, { time: "asc" }],
            })
        );
        return NextResponse.json(schedules);
    } catch (error) {
        console.error("[schedule/all GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
