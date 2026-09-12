import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/blog/[id] */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const courseId = req.headers.get("x-course-id");
    if (!courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const post = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.post.findUnique({ where: { id, courseId } })
    );
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(post);
}

/** PATCH /api/blog/[id] — update post fields */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { id } = await params;

    try {
        const body = await req.json();
        const { title, slug, excerpt, featuredImage, content, category, metaTitle, metaDescription, keywords, status } = body;

        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (slug !== undefined) updateData.slug = slug;
        if (excerpt !== undefined) updateData.excerpt = excerpt;
        if (featuredImage !== undefined) updateData.featuredImage = featuredImage;
        if (content !== undefined) updateData.content = content;
        if (category !== undefined) updateData.category = category;
        if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
        if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
        if (keywords !== undefined) updateData.keywords = keywords;
        if (status !== undefined) {
            updateData.status = status;
            if (status === "published") updateData.publishedAt = new Date();
        }

        const post = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.post.update({ where: { id, courseId }, data: updateData })
        );
        return NextResponse.json(post);
    } catch (error) {
        console.error("Failed to update post:", error);
        return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
    }
}

/** DELETE /api/blog/[id] */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { id } = await params;

    try {
        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.post.delete({ where: { id, courseId } })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete post:", error);
        return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
    }
}
