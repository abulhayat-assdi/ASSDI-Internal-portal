import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/blog/[id]/publish — set status to published */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { id } = await params;

    try {
        const post = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.post.update({
                where: { id, courseId },
                data: { status: "published", publishedAt: new Date() },
            })
        );
        return NextResponse.json(post);
    } catch (error) {
        console.error("Failed to publish post:", error);
        return NextResponse.json({ error: "Failed to publish post" }, { status: 500 });
    }
}
