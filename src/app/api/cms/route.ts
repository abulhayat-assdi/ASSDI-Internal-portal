export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

// GET /api/cms?pageId=home_page — public endpoint, no auth required.
//
// Backs the old single-institute public marketing pages, served on the bare
// root domain with no course context. Slated for replacement by the
// course-directory site (multi-tenant Step 5) — until then this just tells
// callers to fall back to their built-in defaults.
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get("pageId");

    if (!pageId) {
        return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    return NextResponse.json({});
}
