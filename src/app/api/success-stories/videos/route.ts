import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/success-stories/videos */
export async function GET(req: NextRequest) {
    const courseId = req.headers.get("x-course-id");
    if (!courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const videos = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.videoStory.findMany({ where: { courseId }, orderBy: { order: "asc" } })
    );
    return NextResponse.json(videos);
}

/** POST /api/success-stories/videos */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { youtubeUrl, videoId, title, label, studentName, batch, order } = body;

        const video = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.videoStory.create({
                data: {
                    courseId,
                    youtubeUrl,
                    videoId,
                    title,
                    label: label || "",
                    studentName: studentName || "",
                    batch: batch || "",
                    order: Number(order) || 0,
                },
            })
        );

        return NextResponse.json(video, { status: 201 });
    } catch (error) {
        console.error("[VideoStories POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/success-stories/videos */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, ...data } = body;
        const video = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.videoStory.update({ where: { id, courseId }, data })
        );
        return NextResponse.json(video);
    } catch (error) {
        console.error("[VideoStories PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/success-stories/videos?id=... */
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
        tx.videoStory.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}
