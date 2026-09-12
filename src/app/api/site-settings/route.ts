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

            const logoUrl = (cms?.logoUrl as string) || course?.logoUrl || null;
            const siteName = (cms?.siteName as string) || course?.name || null;
            const features = getTenantFeatures(course?.settings);

            return NextResponse.json({ logoUrl, siteName, features });
        });
    } catch {
        return NextResponse.json({ logoUrl: null, siteName: null, features: {} });
    }
}
