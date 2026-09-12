import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/resources/module
 * ?teacherUid=xxx            → all files for a teacher
 * ?teacherUid=xxx&root=true  → root-level files (no folder)
 * ?folderId=xxx              → files inside a specific folder
 * ?all=true                  → all files (admin)
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const teacherUid = searchParams.get("teacherUid");
    const folderId   = searchParams.get("folderId");
    const root       = searchParams.get("root") === "true";
    const all        = searchParams.get("all") === "true";

    const where: Record<string, unknown> = { courseId };

    if (!isTeacherOrAdmin(user)) {
        where.isHidden = false;
    }

    if (all) {
        // no extra filter
    } else if (folderId) {
        where.folderId = folderId;
    } else if (teacherUid) {
        where.teacherUid = teacherUid;
        if (root) where.folderId = null;
    }

    try {
        const resources = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.moduleResource.findMany({
                where,
                orderBy: { uploadedAt: "desc" },
            })
        );
        return NextResponse.json(resources);
    } catch (error) {
        console.error("[ModuleResource GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** POST /api/resources/module */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const body = await req.json();
    const {
        moduleId, moduleTitle, teacherName, teacherUid, folderId,
        title, description, fileType, fileName, fileUrl, storagePath,
        fileSize, resourceType, visibleForBatches, isHidden,
    } = body;

    const resourceData = {
        courseId,
        moduleId:    moduleId    || "",
        moduleTitle: moduleTitle || "",
        teacherName: teacherName || user.displayName || "",
        teacherUid:  teacherUid  || user.id,
        folderId: folderId || null,
        title,
        description: description || null,
        fileType: fileType || "",
        fileName: fileName || "",
        fileUrl: fileUrl || "",
        storagePath: storagePath || "",
        fileSize: fileSize || null,
        resourceType: resourceType || "Other",
        visibleForBatches: visibleForBatches || ["all"],
        isHidden: isHidden || false,
    };

    try {
        const resource = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.moduleResource.create({ data: resourceData })
        );
        return NextResponse.json(resource, { status: 201 });
    } catch (error) {
        console.error("[ModuleResource POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/resources/module */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        const resource = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.moduleResource.update({ where: { id, courseId }, data })
        );
        return NextResponse.json(resource);
    } catch (error) {
        console.error("[ModuleResource PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/resources/module?id=... */
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
            tx.moduleResource.delete({ where: { id, courseId } })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[ModuleResource DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
