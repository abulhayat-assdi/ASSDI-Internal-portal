import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/blog/comments?postId=... */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");
    if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

    const courseId = req.headers.get("x-course-id");
    if (!courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const comments = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.blogComment.findMany({
            where: { courseId, postId },
            orderBy: { createdAt: "asc" },
        })
    );

    return NextResponse.json(
        comments.map(c => ({
            id: c.id,
            postId: c.postId,
            authorName: c.name,
            content: c.content,
            createdAt: c.createdAt,
        }))
    );
}

/** POST /api/blog/comments */
export async function POST(req: NextRequest) {
    try {
        const courseId = req.headers.get("x-course-id");
        if (!courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { postId, authorName, content } = body;

        if (!postId || !authorName || !content) {
            return NextResponse.json({ error: "postId, authorName, and content required" }, { status: 400 });
        }

        const comment = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.blogComment.create({
                data: { courseId, postId, name: authorName, content },
            })
        );

        return NextResponse.json({
            id: comment.id,
            postId: comment.postId,
            authorName: comment.name,
            content: comment.content,
            createdAt: comment.createdAt,
        }, { status: 201 });
    } catch (error) {
        console.error("[Blog Comments POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/blog/comments?id=... — admin only */
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
        tx.blogComment.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}
