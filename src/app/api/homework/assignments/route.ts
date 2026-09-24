import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/homework/assignments?teacherUid=...&batchName=...&includeShared=true */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const teacherUid = searchParams.get("teacherUid");
    const batchName = searchParams.get("batchName");
    const includeShared = searchParams.get("includeShared") !== "false";

    // Student context: return assignments for this batch OR "all" batches, excluding expired ones
    if (batchName) {
        const today = new Date().toISOString().split("T")[0];
        const assignments = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.homeworkAssignment.findMany({
                where: {
                    courseId,
                    batchName: { in: [batchName, "all"] },
                    deadlineDate: { gte: today },
                },
                orderBy: { createdAt: "desc" },
            })
        );
        return NextResponse.json(assignments);
    }

    // Teacher context: own assignments + ones shared with this teacher (view-only)
    if (teacherUid) {
        const assignments = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.homeworkAssignment.findMany({
                where: includeShared
                    ? {
                        courseId,
                        OR: [
                            { teacherUid },
                            { shares: { some: { sharedWithTeacherUid: teacherUid, courseId } } },
                        ],
                    }
                    : { courseId, teacherUid },
                include: { shares: { select: { sharedWithTeacherUid: true, sharedWithTeacherName: true, sharedByUid: true } } },
                orderBy: { createdAt: "desc" },
            })
        );

        return NextResponse.json(
            assignments.map((a) => ({
                ...a,
                shares: undefined,
                isSharedWithMe: a.teacherUid !== teacherUid,
                sharedCount: a.shares.length,
                sharedWith: a.shares,
            }))
        );
    }

    const assignments = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.homeworkAssignment.findMany({
            where: { courseId },
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

/** PATCH /api/homework/assignments — owner (or admin) only. Shared teachers are view-only. */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        // Never allow ownership transfer through this endpoint
        delete (data as Record<string, unknown>).teacherUid;
        delete (data as Record<string, unknown>).teacherName;
        delete (data as Record<string, unknown>).courseId;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const existing = await tx.homeworkAssignment.findUnique({ where: { id, courseId } });
            if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
            const isOwner = existing.teacherUid === user.id;
            const isAdminUser = user.role === "admin" || user.role === "super_admin";
            if (!isOwner && !isAdminUser) {
                return NextResponse.json({ error: "Only the owner can edit this assignment." }, { status: 403 });
            }
            const assignment = await tx.homeworkAssignment.update({ where: { id, courseId }, data });
            return NextResponse.json(assignment);
        });
    } catch (error) {
        console.error("[Assignments PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/homework/assignments?id=... — owner (or admin) only. Shares cascade-delete. */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const existing = await tx.homeworkAssignment.findUnique({ where: { id, courseId } });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const isOwner = existing.teacherUid === user.id;
        const isAdminUser = user.role === "admin" || user.role === "super_admin";
        if (!isOwner && !isAdminUser) {
            return NextResponse.json({ error: "Only the owner can delete this assignment." }, { status: 403 });
        }
        await tx.homeworkAssignment.delete({ where: { id, courseId } });
        return NextResponse.json({ success: true });
    });
}
