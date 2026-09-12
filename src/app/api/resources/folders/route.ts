import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/resources/folders
 * ?teacherUid=xxx            → all root folders for a teacher (no parentFolderId)
 * ?parentFolderId=xxx        → sub-folders of a folder
 * ?all=true                  → all folders (admin use)
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const teacherUid      = searchParams.get("teacherUid");
    const parentFolderId  = searchParams.get("parentFolderId");
    const all             = searchParams.get("all") === "true";

    const where: Record<string, unknown> = { courseId };

    if (all) {
        // no extra filter
    } else if (parentFolderId) {
        where.parentFolderId = parentFolderId;
    } else if (teacherUid) {
        where.teacherUid = teacherUid;
        where.parentFolderId = null; // root folders only
    }

    try {
        const folders = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.moduleFolder.findMany({
                where,
                orderBy: { createdAt: "asc" },
            })
        );
        return NextResponse.json(folders);
    } catch (error) {
        console.error("[Folders GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** POST /api/resources/folders */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const body = await req.json();
    const { teacherUid, teacherName, parentFolderId, title, description, visibleForBatches, isHidden } = body;

    const folderData = {
        courseId,
        teacherUid:        teacherUid        || user.id,
        teacherName:       teacherName       || user.displayName || "",
        parentFolderId:    parentFolderId    || null,
        title:             title             || "",
        description:       description       || null,
        visibleForBatches: visibleForBatches || ["all"],
        isHidden:          isHidden          || false,
    };

    try {
        const folder = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.moduleFolder.create({ data: folderData })
        );
        return NextResponse.json(folder, { status: 201 });
    } catch (error) {
        console.error("[Folders POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/resources/folders */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        const folder = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.moduleFolder.update({ where: { id, courseId }, data })
        );
        return NextResponse.json(folder);
    } catch (error) {
        console.error("[Folders PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/resources/folders?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    try {
        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.moduleFolder.delete({ where: { id, courseId } })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Folders DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
