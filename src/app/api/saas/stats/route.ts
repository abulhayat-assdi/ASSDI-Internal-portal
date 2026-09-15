export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { getBilling } from "@/lib/billing";

/** GET /api/saas/stats — platform analytics (super_admin only) */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const last7 = new Date(now.getTime() - 7 * day);
    const last30 = new Date(now.getTime() - 30 * day);
    const last14 = new Date(now.getTime() - 13 * day);

    const data = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const [courses, roleCounts, activeSessions, recentLogins, signups] = await Promise.all([
            tx.course.findMany({ orderBy: { name: "asc" } }),
            tx.user.groupBy({
                by: ["courseId", "role"],
                where: { deletedAt: null },
                _count: { role: true },
            }),
            tx.activeSession.count({ where: { expiresAt: { gt: now } } }),
            tx.user.count({ where: { deletedAt: null, lastLoginAt: { gte: last7 } } }),
            tx.user.findMany({
                where: { deletedAt: null, createdAt: { gte: last14 } },
                select: { createdAt: true, role: true },
            }),
        ]);

        // Per-course rollups (counts only — no per-user data leaves the server)
        const perCourse = await Promise.all(
            courses.map(async (c) => {
                const [students, teachers, admins, batches, logins7, logins30] = await Promise.all([
                    tx.user.count({ where: { courseId: c.id, role: "student", deletedAt: null } }),
                    tx.user.count({ where: { courseId: c.id, role: "teacher", deletedAt: null } }),
                    tx.user.count({ where: { courseId: c.id, role: "admin", deletedAt: null } }),
                    tx.batch.count({ where: { courseId: c.id } }),
                    tx.user.count({ where: { courseId: c.id, deletedAt: null, lastLoginAt: { gte: last7 } } }),
                    tx.user.count({ where: { courseId: c.id, deletedAt: null, lastLoginAt: { gte: last30 } } }),
                ]);
                return {
                    id: c.id, slug: c.slug, name: c.name, status: c.status,
                    createdAt: c.createdAt,
                    billing: getBilling(c.settings),
                    students, teachers, admins, batches, logins7, logins30,
                };
            })
        );

        // Signups per day (last 14 days)
        const days: { date: string; students: number; teachers: number }[] = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now.getTime() - i * day);
            const key = d.toISOString().slice(0, 10);
            days.push({ date: key, students: 0, teachers: 0 });
        }
        for (const s of signups) {
            const key = s.createdAt.toISOString().slice(0, 10);
            const bucket = days.find((d) => d.date === key);
            if (bucket) {
                if (s.role === "student") bucket.students++;
                else if (s.role === "teacher") bucket.teachers++;
            }
        }

        const totals: Record<string, number> = { student: 0, teacher: 0, admin: 0, super_admin: 0 };
        for (const r of roleCounts) totals[r.role] = (totals[r.role] ?? 0) + r._count.role;

        return { perCourse, totals, activeSessions, recentLogins, signupTrend: days, courseCount: courses.length };
    });

    return NextResponse.json(data);
}
