export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

// ─── GET /api/deployments/admin/student/[userId] ──────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const { userId } = await params;

    try {
        const { user, deployments } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const [user, deployments] = await Promise.all([
                tx.user.findUnique({
                    where: { id: userId, courseId },
                    select: {
                        id: true,
                        displayName: true,
                        studentBatchName: true,
                        studentRoll: true,
                        deploymentLimit: true,
                        isDeploymentFrozen: true,
                    },
                }),
                tx.deployment.findMany({
                    where: { userId, courseId },
                    orderBy: { createdAt: "desc" },
                }),
            ]);
            return { user, deployments };
        });

        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        return NextResponse.json({ user, deployments });
    } catch (error) {
        console.error("[Admin Student Deployments GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// ─── PATCH /api/deployments/admin/student/[userId] ───────────────────────────

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const { userId } = await params;

    try {
        const body = await req.json();
        const { deploymentLimit, isDeploymentFrozen } = body as {
            deploymentLimit?: number;
            isDeploymentFrozen?: boolean;
        };

        const updateData: { deploymentLimit?: number; isDeploymentFrozen?: boolean } = {};

        if (typeof deploymentLimit === "number") {
            if (deploymentLimit < 0 || deploymentLimit > 100) {
                return NextResponse.json({ error: "Deployment limit must be between 0 and 100." }, { status: 400 });
            }
            updateData.deploymentLimit = deploymentLimit;
        }

        if (typeof isDeploymentFrozen === "boolean") {
            updateData.isDeploymentFrozen = isDeploymentFrozen;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
        }

        const updated = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.user.update({
                where: { id: userId, courseId },
                data: updateData,
                select: {
                    id: true,
                    deploymentLimit: true,
                    isDeploymentFrozen: true,
                },
            })
        );

        return NextResponse.json({ user: updated });
    } catch (error) {
        console.error("[Admin Student Deployments PATCH]", error);
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
