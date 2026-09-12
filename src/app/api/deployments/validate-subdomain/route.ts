export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const RESERVED_SUBDOMAINS = new Set([
    "www", "api", "admin", "mail", "portal", "app", "cdn", "ftp",
    "smtp", "imap", "pop", "dev", "staging", "test", "demo", "static",
    "assets", "media", "img", "images", "upload", "uploads",
]);

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

// ─── GET /api/deployments/validate-subdomain?subdomain=xyz ───────────────────

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subdomain = searchParams.get("subdomain")?.toLowerCase().trim() ?? "";
    const excludeId = searchParams.get("excludeId");

    if (!subdomain) {
        return NextResponse.json({ available: false, error: "Subdomain is required." });
    }

    if (!SUBDOMAIN_REGEX.test(subdomain)) {
        return NextResponse.json({
            available: false,
            error: "Only lowercase letters, numbers, and hyphens allowed. Min 3 chars.",
        });
    }

    if (RESERVED_SUBDOMAINS.has(subdomain)) {
        return NextResponse.json({ available: false, error: `"${subdomain}" is reserved.` });
    }

    try {
        // Deployment subdomains are a platform-wide namespace — check across
        // ALL courses via the super-admin RLS bypass.
        const existing = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
            tx.deployment.findUnique({
                where: { subdomain },
                select: { id: true },
            })
        );

        if (existing && existing.id !== excludeId) {
            return NextResponse.json({ available: false, error: "This subdomain is already taken." });
        }

        return NextResponse.json({ available: true });
    } catch (error) {
        console.error("[validate-subdomain]", error);
        return NextResponse.json({ available: false, error: "Server error" }, { status: 500 });
    }
}
