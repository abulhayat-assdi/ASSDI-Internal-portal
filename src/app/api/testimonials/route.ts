import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function extractVideoId(url: string): string {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return "";
}

/** GET /api/testimonials — return in shape the frontend service expects */
export async function GET(req: NextRequest) {
    const courseId = req.headers.get("x-course-id");
    if (!courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.videoTestimonial.findMany({
            where: { courseId, isPublished: true },
            orderBy: { order: "asc" },
        })
    );

    // Map DB fields → service interface shape
    const result = items.map((item) => ({
        id: item.id,
        youtubeUrl: item.videoUrl,
        videoId: item.videoId || extractVideoId(item.videoUrl),
        title: item.title,
        studentName: item.studentName || "",
        order: item.order,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    }));

    return NextResponse.json(result);
}

/** POST /api/testimonials */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { youtubeUrl, videoId: bodyVideoId, title, studentName, order } = body;

        const resolvedVideoId = bodyVideoId || extractVideoId(youtubeUrl || "");

        const item = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.videoTestimonial.create({
                data: {
                    courseId,
                    title: title || "",
                    videoUrl: youtubeUrl || "",
                    videoId: resolvedVideoId,
                    studentName: studentName || "",
                    thumbnailUrl: resolvedVideoId
                        ? `https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`
                        : null,
                    isPublished: true,
                    order: Number(order) || 0,
                },
            })
        );

        return NextResponse.json({
            id: item.id,
            youtubeUrl: item.videoUrl,
            videoId: item.videoId,
            title: item.title,
            studentName: item.studentName,
            order: item.order,
        }, { status: 201 });
    } catch (error) {
        console.error("[Testimonials POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/testimonials */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, youtubeUrl, videoId: bodyVideoId, title, studentName, order } = body;

        const resolvedVideoId = bodyVideoId || (youtubeUrl ? extractVideoId(youtubeUrl) : undefined);

        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (studentName !== undefined) updateData.studentName = studentName;
        if (order !== undefined) updateData.order = Number(order);
        if (youtubeUrl !== undefined) updateData.videoUrl = youtubeUrl;
        if (resolvedVideoId !== undefined) {
            updateData.videoId = resolvedVideoId;
            updateData.thumbnailUrl = `https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`;
        }

        const item = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.videoTestimonial.update({ where: { id, courseId }, data: updateData })
        );

        return NextResponse.json({
            id: item.id,
            youtubeUrl: item.videoUrl,
            videoId: item.videoId,
            title: item.title,
            studentName: item.studentName,
            order: item.order,
        });
    } catch (error) {
        console.error("[Testimonials PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/testimonials?id=... */
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
        tx.videoTestimonial.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}
