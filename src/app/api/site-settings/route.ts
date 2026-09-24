export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser } from "@/lib/auth";
import { getTenantFeatures } from "@/lib/features";

// GET /api/site-settings — sidebar-এর জন্য: logo, siteName, feature flags
export async function GET() {
    try {
        const caller = await getServerSessionUser();
        if (!caller || !caller.courseId) {
            return NextResponse.json({ logoUrl: null, siteName: null, features: {} });
        }
        const courseId = caller.courseId;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const [cmsRecord, course] = await Promise.all([
                tx.cmsContent.findUnique({ where: { courseId_key: { courseId, key: "site_settings" } } }),
                tx.course.findUnique({ where: { id: courseId } }),
            ]);
            const cms = cmsRecord?.value as Record<string, unknown> | null;

            // Course row first: it is the editable source of truth (Super Admin →
            // Courses, and Dashboard → Branding). The cms `site_settings` record is
            // legacy single-tenant data kept only as a fallback.
            const logoUrl = course?.logoUrl || (cms?.logoUrl as string) || null;
            const siteName = course?.name || (cms?.siteName as string) || null;
            const features = getTenantFeatures(course?.settings);

            return NextResponse.json({ logoUrl, siteName, features });
        });
    } catch {
        return NextResponse.json({ logoUrl: null, siteName: null, features: {} });
    }
}
