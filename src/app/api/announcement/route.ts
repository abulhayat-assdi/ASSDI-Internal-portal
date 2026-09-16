export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ANNOUNCEMENT_KEY } from "@/lib/announcement";

/** GET /api/announcement — this course's active platform announcement (any logged-in user) */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !caller.courseId) {
        return NextResponse.json({ announcement: null });
    }
    const courseId = caller.courseId;
    const row = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.cmsContent.findUnique({ where: { courseId_key: { courseId, key: ANNOUNCEMENT_KEY } } })
    );
    if (!row) return NextResponse.json({ announcement: null });
    const v = row.value as { expiresAt?: string | null };
    if (v?.expiresAt && new Date(v.expiresAt).getTime() < Date.now()) {
        return NextResponse.json({ announcement: null });
    }
    return NextResponse.json({ announcement: row.value, updatedAt: row.updatedAt });
}
