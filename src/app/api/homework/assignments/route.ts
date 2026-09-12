import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/homework/assignments?teacherUid=...&batchName=... */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const teacherUid = searchParams.get("teacherUid");
    const batchName = searchParams.get("batchName");

    const where: any = { courseId };
    if (teacherUid) where.teacherUid = teacherUid;
    if (batchName) {
        // Student context: return assignments for this batch OR "all" batches, excluding expired ones
        const today = new Date().toISOString().split("T")[0];
        where.batchName = { in: [batchName, "all"] };
        where.deadlineDate = { gte: today };
    }

    const assignments = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.homeworkAssignment.findMany({
            where,
            orderBy: { createdAt: "desc" },
        })
    );

    return NextResponse.json(assignments);
}

/** POST /api/homework/assignments */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { teacherUid, teacherName, title, deadlineDate, batchName } = body;

        const assignment = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.homeworkAssignment.create({
                data: {
                    courseId,
                    teacherUid: teacherUid || user.id,
                    teacherName: teacherName || user.displayName,
                    title,
                    deadlineDate,
                    batchName,
                },
            })
        );

        return NextResponse.json(assignment, { status: 201 });
    } catch (error) {
        console.error("[Assignments POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/homework/assignments */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        const assignment = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.homeworkAssignment.update({ where: { id, courseId }, data })
        );
        return NextResponse.json(assignment);
    } catch (error) {
        console.error("[Assignments PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/homework/assignments?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.homeworkAssignment.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}
