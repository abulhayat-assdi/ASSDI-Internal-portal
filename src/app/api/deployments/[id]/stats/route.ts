export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

const DAYS = 30;

// ─── GET /api/deployments/[id]/stats — unique visitors per day, last 30 days ──

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "আপনার সেশনের মেয়াদ শেষ। আবার লগইন করুন।" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    const since = new Date(Date.now() - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10);

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const deployment = await tx.deployment.findUnique({
                where: { id, courseId },
                select: { userId: true, totalVisitors: true },
            });
            if (!deployment) return null;
            if (deployment.userId !== user.id && !isAdmin(user)) return "forbidden" as const;

            const rows = await tx.visitorLog.groupBy({
                by: ["date"],
                where: { deploymentId: id, date: { gte: since } },
                _count: { _all: true },
            });
            return { totalVisitors: deployment.totalVisitors, rows };
        });

        if (!result) return NextResponse.json({ error: "সাইটটি পাওয়া যায়নি।" }, { status: 404 });
        if (result === "forbidden") return NextResponse.json({ error: "এই সাইটটি আপনার নয়।" }, { status: 403 });

        const counts = new Map(result.rows.map((r) => [r.date, r._count._all]));
        const days = Array.from({ length: DAYS }, (_, i) => {
            const date = new Date(Date.now() - (DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10);
            return { date, visitors: counts.get(date) ?? 0 };
        });

        return NextResponse.json({ totalVisitors: result.totalVisitors, days });
    } catch (error) {
        console.error("[Deployment stats]", error);
        return NextResponse.json({ error: "পরিসংখ্যান লোড করা যাচ্ছে না।" }, { status: 500 });
    }
}
