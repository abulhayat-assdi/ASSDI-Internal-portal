export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { withCourseContext } from "@/lib/db";

const TRANSPARENT_GIF = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
);

function getTodayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function hashIp(ip: string): string {
    return createHash("sha256").update(ip + (process.env.JWT_SECRET ?? "asm-pixel-salt")).digest("hex");
}

function getClientIp(req: NextRequest): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown"
    );
}

// ─── GET /api/deployments/pixel?id=<deploymentId> ────────────────────────────
// Public, unauthenticated — hit by any visitor of a deployed student site.

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const deploymentId = searchParams.get("id")?.trim();

    if (!deploymentId) {
        return new NextResponse(TRANSPARENT_GIF, {
            headers: {
                "Content-Type": "image/gif",
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Pragma": "no-cache",
            },
        });
    }

    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const today = getTodayDate();
    const hashedIp = hashIp(clientIp);

    withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const deployment = await tx.deployment.findUnique({ where: { id: deploymentId }, select: { courseId: true } });
        if (!deployment) return;

        await Promise.all([
            tx.deployment.updateMany({
                where: { id: deploymentId },
                data: { totalVisitors: { increment: 1 } },
            }),
            tx.visitorLog.create({
                data: {
                    courseId: deployment.courseId,
                    deploymentId,
                    visitorIp: hashedIp,
                    userAgent,
                    date: today,
                },
            }),
        ]);
    }).catch((err) => {
        console.error("[Pixel] Failed to record visit:", err);
    });

    return new NextResponse(TRANSPARENT_GIF, {
        headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    });
}
