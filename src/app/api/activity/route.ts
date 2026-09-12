import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/activity?limit=5 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const logs = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.activityLog.findMany({
            where: { courseId },
            orderBy: { createdAt: "desc" },
            take: limit,
        })
    );

    return NextResponse.json(logs);
}

/** POST /api/activity */
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !user.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const { actorUid, actorRole, actionType, targetType, targetId, description } = body;

        if (!actorUid || !actorRole || !actionType || !targetType || !targetId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const log = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.activityLog.create({
                data: { courseId, actorUid, actorRole, actionType, targetType, targetId, description: description || "" },
            })
        );

        return NextResponse.json(log, { status: 201 });
    } catch (error) {
        console.error("[Activity POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
