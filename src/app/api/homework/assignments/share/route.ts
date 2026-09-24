import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Homework assignment sharing (view-only, no re-share).
 * - Only the assignment owner (or admin) can share / unshare / list shares.
 * - A teacher can never share with themselves.
 */

async function canManage(
    tx: Parameters<Parameters<typeof withCourseContext>[1]>[0],
    assignmentId: string,
    courseId: string,
    userId: string,
    role: string
) {
    const assignment = await tx.homeworkAssignment.findUnique({
        where: { id: assignmentId, courseId },
        select: { id: true, teacherUid: true },
    });
    if (!assignment) return { ok: false as const, status: 404 as const, error: "Assignment not found" };
    const isOwner = assignment.teacherUid === userId;
    const isAdminUser = role === "admin" || role === "super_admin";
    if (!isOwner && !isAdminUser) {
        return { ok: false as const, status: 403 as const, error: "Only the owner can manage sharing." };
    }
    return { ok: true as const, assignment };
}

/** GET /api/homework/assignments/share?assignmentId=... — list teachers this folder is shared with */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");
    if (!assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });

    return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const access = await canManage(tx, assignmentId, courseId, user.id, user.role);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        const shares = await tx.homeworkAssignmentShare.findMany({
            where: { assignmentId, courseId },
            orderBy: { createdAt: "asc" },
        });
        return NextResponse.json(shares);
    });
}

/** POST /api/homework/assignments/share — { assignmentId, teachers: [{ uid, name }] } */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    let body: { assignmentId?: string; teachers?: { uid: string; name: string }[] };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { assignmentId, teachers } = body;
    if (!assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
    if (!Array.isArray(teachers) || teachers.length === 0) {
        return NextResponse.json({ error: "teachers[] required" }, { status: 400 });
    }

    return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const access = await canManage(tx, assignmentId, courseId, user.id, user.role);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

        // Dedupe + never allow sharing with self (the owner)
        const seen = new Set<string>();
        const rows = [];
        for (const t of teachers) {
            const uid = t?.uid?.trim();
            const name = t?.name?.trim();
            if (!uid || !name || uid === access.assignment.teacherUid || seen.has(uid)) continue;
            seen.add(uid);
            rows.push({
                courseId,
                assignmentId,
                sharedWithTeacherUid: uid,
                sharedWithTeacherName: name,
                sharedByUid: user.id,
            });
        }
        if (rows.length > 0) {
            await tx.homeworkAssignmentShare.createMany({ data: rows, skipDuplicates: true });
        }
        const shares = await tx.homeworkAssignmentShare.findMany({
            where: { assignmentId, courseId },
            orderBy: { createdAt: "asc" },
        });
        return NextResponse.json(shares, { status: 201 });
    });
}

/** DELETE /api/homework/assignments/share?assignmentId=...&teacherUid=... — revoke one share */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");
    const teacherUid = searchParams.get("teacherUid");
    if (!assignmentId || !teacherUid) {
        return NextResponse.json({ error: "assignmentId and teacherUid required" }, { status: 400 });
    }

    return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const access = await canManage(tx, assignmentId, courseId, user.id, user.role);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        await tx.homeworkAssignmentShare.deleteMany({
            where: { assignmentId, courseId, sharedWithTeacherUid: teacherUid },
        });
        return NextResponse.json({ success: true });
    });
}
