export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

const TRANSPARENT_GIF = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
);

// ─── GET /api/deployments/pixel?id=<deploymentId> ────────────────────────────
// Public, unauthenticated. Sites deployed before visits moved to serve-site
// still have this tracking pixel in their index.html. It used to count a
// second visit on top of serve-site's, so it now only returns the image.

export async function GET() {
    return new NextResponse(TRANSPARENT_GIF, {
        headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "public, max-age=86400",
        },
    });
}
