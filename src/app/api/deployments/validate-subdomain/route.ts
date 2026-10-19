export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { normalizeSubdomain, subdomainProblem } from "@/lib/deploymentRules";

// ─── GET /api/deployments/validate-subdomain?subdomain=xyz ───────────────────

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student") {
        return NextResponse.json(
            { available: false, reason: "error", error: "আপনার সেশনের মেয়াদ শেষ। আবার লগইন করুন।" },
            { status: 401 }
        );
    }

    const { searchParams } = new URL(req.url);
    const subdomain = normalizeSubdomain(searchParams.get("subdomain") ?? "");
    const excludeId = searchParams.get("excludeId");

    const problem = subdomainProblem(subdomain);
    if (problem) {
        return NextResponse.json({ available: false, reason: "invalid", error: problem });
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
            return NextResponse.json({
                available: false,
                reason: "taken",
                error: `"${subdomain}" নামটি আগেই অন্য একটি সাইট নিয়ে নিয়েছে। অন্য নাম দিন।`,
            });
        }

        return NextResponse.json({ available: true });
    } catch (error) {
        console.error("[validate-subdomain]", error);
        return NextResponse.json(
            { available: false, reason: "error", error: "এই মুহূর্তে চেক করা যাচ্ছে না। আবার চেষ্টা করুন।" },
            { status: 500 }
        );
    }
}
