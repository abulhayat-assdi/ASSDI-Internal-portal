import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/resources */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const resources = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.resource.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } })
    );
    return NextResponse.json(resources);
}

/** POST /api/resources */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { title, description, fileType, fileName, fileUrl, storagePath, fileSize, uploadedBy } = body;

        const resource = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.resource.create({
                data: {
                    courseId,
                    title,
                    description: description || null,
                    fileType: fileType || "",
                    fileName: fileName || "",
                    fileUrl: fileUrl || "",
                    storagePath: storagePath || "",
                    fileSize: fileSize || null,
                    uploadedBy: uploadedBy || user.id,
                },
            })
        );

        return NextResponse.json(resource, { status: 201 });
    } catch (error) {
        console.error("[Resources POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/resources */
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
            tx.resource.update({ where: { id, courseId }, data })
        );
        return NextResponse.json(resource);
    } catch (error) {
        console.error("[Resources PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/resources?id=... */
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
        tx.resource.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}
