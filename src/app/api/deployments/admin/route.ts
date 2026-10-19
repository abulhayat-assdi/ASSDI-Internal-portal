export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { withLiveUrl } from "@/lib/deploymentSite";

// ─── GET /api/deployments/admin ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

    try {
        const { deployments, archivedBatches } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => ({
            archivedBatches: await tx.batch.findMany({ where: { courseId, status: "archived" }, select: { name: true } }),
            deployments: await tx.deployment.findMany({
                where: { courseId },
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            id: true,
                            displayName: true,
                            studentBatchName: true,
                            studentRoll: true,
                            deploymentLimit: true,
                            isDeploymentFrozen: true,
                            deployAfterBatchEnd: true,
                        },
                    },
                },
            }),
        }));
        const archived = new Set(archivedBatches.map((b) => b.name));

        const filtered = search
            ? deployments.filter((d) => {
                return (
                    d.subdomain.toLowerCase().includes(search) ||
                    d.user.displayName.toLowerCase().includes(search) ||
                    (d.user.studentRoll ?? "").toLowerCase().includes(search) ||
                    (d.user.studentBatchName ?? "").toLowerCase().includes(search)
                );
            })
            : deployments;

        const totalVisitors = deployments.reduce((sum, d) => sum + d.totalVisitors, 0);

        return NextResponse.json({
            deployments: filtered.map((d) => ({
                ...withLiveUrl(d),
                batchCompleted: !!d.user.studentBatchName && archived.has(d.user.studentBatchName),
            })),
            stats: {
                total: deployments.length,
                totalVisitors,
                totalBytes: deployments.reduce((sum, d) => sum + d.sizeBytes, 0),
                flagged: deployments.filter((d) => d.riskFlags.length > 0).length,
            },
        });
    } catch (error) {
        console.error("[Deployments Admin GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
