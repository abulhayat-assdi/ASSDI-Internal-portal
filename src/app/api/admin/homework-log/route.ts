import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { HOMEWORK_ACTIONS } from "@/lib/homeworkLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 50;

/**
 * GET /api/admin/homework-log?page=&action=&q=&from=&to=
 * The homework audit trail: who created, edited, shared, viewed and deleted
 * what, and when. Admin only. `from`/`to` are YYYY-MM-DD, inclusive.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const action = searchParams.get("action") || "";
    const q = (searchParams.get("q") || "").trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const createdAt: { gte?: Date; lt?: Date } = {};
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) createdAt.gte = new Date(`${from}T00:00:00`);
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        const end = new Date(`${to}T00:00:00`);
        end.setDate(end.getDate() + 1);
        createdAt.lt = end;
    }

    const where = {
        courseId,
        actionType: (HOMEWORK_ACTIONS as readonly string[]).includes(action)
            ? action
            : { in: [...HOMEWORK_ACTIONS] },
        ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
        ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const { logs, total } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const [logs, total] = await Promise.all([
            tx.activityLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * PAGE_SIZE,
                take: PAGE_SIZE,
                include: { actor: { select: { displayName: true } } },
            }),
            tx.activityLog.count({ where }),
        ]);
        return { logs, total };
    });

    return NextResponse.json({
        logs: logs.map((l) => ({
            id: l.id,
            actionType: l.actionType,
            actorName: l.actor?.displayName ?? null,
            actorRole: l.actorRole,
            description: l.description,
            createdAt: l.createdAt,
        })),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
}
