export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { withCourseContext } from "@/lib/db";
import { removeOrphanSiteFolders } from "@/lib/deploymentSite";

/**
 * POST /api/cron/deployment-cleanup — removes student-site folders that no
 * deployment row points at any more (sites of users deleted before files
 * were cleaned up with them, crashed or abandoned uploads).
 *
 * Same CRON_SECRET header auth as /api/cron/attendance-alerts; the app runs
 * it itself once a day (see instrumentation.ts).
 */
function authorised(req: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected || expected.length < 16) return false;

    const provided = req.headers.get("x-cron-secret");
    if (!provided) return false;

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
    if (!authorised(req)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.deployment.findMany({ select: { folderPath: true } })
    );
    const removed = await removeOrphanSiteFolders(rows.map((r) => r.folderPath));
    return NextResponse.json({ removed: removed.length, folders: removed });
}
