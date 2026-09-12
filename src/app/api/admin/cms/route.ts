export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * GET /api/admin/cms
 * Returns all CMS content (admin only)
 *
 * POST /api/admin/cms
 * Upserts a CMS content block by key.
 * Body: { pageId, content }
 */
export async function GET(req: NextRequest) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const contentMap = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const allContent = await tx.cmsContent.findMany({
                where: { courseId },
                orderBy: { key: 'asc' },
            });
            return Object.fromEntries(allContent.map((c) => [c.key, c.value]));
        });

        return NextResponse.json(contentMap);
    } catch (error) {
        console.error("[CMS API] GET Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const { pageId, content } = await req.json();

        if (!pageId || !content) {
            return NextResponse.json({ error: "Missing required fields (pageId, content)" }, { status: 400 });
        }

        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.cmsContent.upsert({
                where: { courseId_key: { courseId, key: pageId } },
                create: { courseId, key: pageId, value: content, updatedBy: caller.id },
                update: { value: content, updatedBy: caller.id },
            })
        );

        // On-demand cache revalidation
        try {
            const pathMap: Record<string, string> = {
                home_page: '/',
                about_page: '/about',
                modules_page: '/modules',
                instructors_page: '/instructors',
                success_stories_page: '/success-stories',
                contact_page: '/contact',
                blog_page: '/blog',
            };

            if (pathMap[pageId]) revalidatePath(pathMap[pageId]);
            revalidatePath('/', 'layout');
        } catch (revalidateError) {
            console.error("[CMS API] Revalidation failed:", revalidateError);
        }

        return NextResponse.json({ success: true, message: "Page content updated and cache purged." });
    } catch (error) {
        console.error("[CMS API] POST Error:", error);
        const message = error instanceof Error ? error.message : "Failed to update page content.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
