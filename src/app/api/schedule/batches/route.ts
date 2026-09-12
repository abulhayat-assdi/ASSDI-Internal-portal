import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/schedule/batches
 *  - Admin: returns ALL batches (active + archived) for management
 *  - Teacher: returns only active batches
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;

    const where = isAdmin(user) ? { courseId } : { courseId, status: "active" as const };

    const batches = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.batch.findMany({
            where,
            orderBy: { name: "asc" },
        })
    );

    return NextResponse.json(batches);
}

/** POST /api/schedule/batches — add a new batch (admin only) */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { name } = await req.json();
    if (!name?.trim()) {
        return NextResponse.json({ error: "Batch name is required" }, { status: 400 });
    }

    const batch = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const existing = await tx.batch.findUnique({ where: { courseId_name: { courseId, name: name.trim() } } });
        if (existing) return null;

        return tx.batch.create({
            data: { courseId, name: name.trim(), status: "active" },
        });
    });

    if (!batch) {
        return NextResponse.json({ error: "Batch already exists" }, { status: 409 });
    }

    return NextResponse.json(batch, { status: 201 });
}

/** PATCH /api/schedule/batches — toggle active/archived status (admin only) */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { id, status } = await req.json();
    if (!id || !status) {
        return NextResponse.json({ error: "Batch id and status are required" }, { status: 400 });
    }

    const batch = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.batch.update({
            where: { id, courseId },
            data: { status },
        })
    );

    return NextResponse.json(batch);
}

/** DELETE /api/schedule/batches — delete a batch (admin only) */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { id } = await req.json();
    if (!id) {
        return NextResponse.json({ error: "Batch id is required" }, { status: 400 });
    }

    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.batch.delete({ where: { id, courseId } })
    );

    return NextResponse.json({ success: true });
}
