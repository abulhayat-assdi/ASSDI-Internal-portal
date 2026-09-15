import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/leaves?teacherId=...&monthYear=... */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;
    const admin = isAdmin(user);

    const { searchParams } = new URL(req.url);
    const monthYear = searchParams.get("monthYear");

    // Non-admins can only ever see their own leave records — the requested
    // teacherId is ignored for them so they can't view/enumerate others' leaves.
    const teacherId = admin ? searchParams.get("teacherId") : user.teacherId;
    if (!admin && !teacherId) return NextResponse.json([]);

    const where: any = { courseId };
    if (teacherId) where.teacherId = teacherId;
    if (monthYear) where.monthYear = monthYear;

    const leaves = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.leave.findMany({
            where,
            orderBy: { startDate: "desc" },
        })
    );

    return NextResponse.json(leaves);
}

/** POST /api/leaves — admin-only; leave records are managed from the admin panel */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { teacherId, teacherName, startDate, endDate, days, type, reason, monthYear } = body;

        const leave = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.leave.create({
                data: {
                    courseId,
                    teacherId,
                    teacherName,
                    startDate,
                    endDate,
                    days: Number(days) || 1,
                    type: type || "Casual",
                    reason: reason || null,
                    monthYear,
                },
            })
        );

        return NextResponse.json(leave, { status: 201 });
    } catch (error) {
        console.error("[Leaves POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/leaves — update a leave record (admin-only) */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        const leave = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.leave.update({ where: { id, courseId }, data })
        );
        return NextResponse.json(leave);
    } catch (error) {
        console.error("[Leaves PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/leaves?id=... (admin-only) */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.leave.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}
