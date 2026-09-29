export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";

const MAX_RANGE_DAYS = 366;

/**
 * GET /api/saas/analytics/logins?from=YYYY-MM-DD&to=YYYY-MM-DD&courseId?
 * Daily login counts (student/teacher/admin breakdown) from the permanent
 * LoginEvent history — super_admin only. Backs the analytics page's login
 * trend chart (weekly/monthly/custom are all just different from/to values
 * chosen by the frontend).
 */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId") || undefined;

    const now = new Date();
    const toParam = searchParams.get("to");
    const fromParam = searchParams.get("from");
    const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : now;
    const from = fromParam
        ? new Date(`${fromParam}T00:00:00.000Z`)
        : new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
        return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
        return NextResponse.json({ error: `Range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
    }

    const events = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.loginEvent.findMany({
            where: { createdAt: { gte: from, lte: to }, ...(courseId ? { courseId } : {}) },
            select: { createdAt: true, role: true },
        })
    );

    const days: { date: string; student: number; teacher: number; admin: number; total: number }[] = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
        days.push({ date: d.toISOString().slice(0, 10), student: 0, teacher: 0, admin: 0, total: 0 });
    }
    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const e of events) {
        const key = e.createdAt.toISOString().slice(0, 10);
        const bucket = byDate.get(key);
        if (!bucket) continue;
        if (e.role === "student") bucket.student++;
        else if (e.role === "teacher") bucket.teacher++;
        else bucket.admin++;
        bucket.total++;
    }

    return NextResponse.json({ days, totalLogins: events.length });
}
