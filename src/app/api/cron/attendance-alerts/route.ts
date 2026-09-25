export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runAttendanceAlerts } from "@/lib/jobs/attendanceAlerts";

/**
 * POST /api/cron/attendance-alerts — the daily attendance sweep.
 *
 * Runs across every course, so it authenticates with CRON_SECRET rather than
 * a session: there is no user behind it. The secret travels in a header, not
 * the query string, because query strings end up in proxy and access logs.
 *
 * The app also fires this itself once a day (see instrumentation.ts); this
 * endpoint exists so a real scheduler can drive it instead, and so it can be
 * triggered by hand while setting things up.
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
        // 404 rather than 403: an unset CRON_SECRET means this route is simply
        // not in use, and there is nothing to probe for.
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const results = await runAttendanceAlerts();
    return NextResponse.json({
        ran: results.length,
        warned: results.reduce((sum, r) => sum + r.warned, 0),
        digests: results.filter((r) => r.digestSent).length,
        results,
    });
}
