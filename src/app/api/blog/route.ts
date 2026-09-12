import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/blog — list posts (admins see all, others see published) */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const user = await getSessionUser(req).catch(() => null);
    const courseId = user?.courseId || req.headers.get("x-course-id");
    if (!courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : undefined;

    const where = user && isAdmin(user) ? { courseId } : { courseId, status: "published" as const };

    const posts = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.post.findMany({
            where,
            take: limit,
            orderBy: { createdAt: "desc" },
        })
    );

    return NextResponse.json(posts);
}

/** POST /api/blog — create a new post */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { title, slug, excerpt, featuredImage, content, category, metaTitle, metaDescription, keywords, status } = body;

        if (!title || !content) {
            return NextResponse.json({ error: "title and content are required" }, { status: 400 });
        }

        const post = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.post.create({
                data: {
                    courseId,
                    title,
                    slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
                    excerpt: excerpt || "",
                    featuredImage: featuredImage || null,
                    content,
                    category: category || null,
                    metaTitle: metaTitle || null,
                    metaDescription: metaDescription || null,
                    keywords: keywords || null,
                    status: status === "published" ? "published" : "draft",
                    publishedAt: status === "published" ? new Date() : null,
                },
            })
        );

        return NextResponse.json({ id: post.id }, { status: 201 });
    } catch (error) {
        console.error("Failed to create post:", error);
        return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }
}
