export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { mkdir, rm, rename } from "fs/promises";
import path from "path";
import * as fs from "fs";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { normalizeSubdomain, subdomainProblem } from "@/lib/deploymentRules";
import {
    buildLiveUrl,
    injectTrackingPixel,
    removeDir,
    safeChildDir,
    studentSitesDir,
    withLiveUrl,
} from "@/lib/deploymentSite";

// ─── PATCH /api/deployments/[id] ─────────────────────────────────────────────

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const deployment = await tx.deployment.findUnique({ where: { id, courseId } });
            if (!deployment) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });

            if (deployment.userId !== user.id) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            const dbUser = await tx.user.findUnique({
                where: { id: user.id },
                select: { isDeploymentFrozen: true },
            });
            if (dbUser?.isDeploymentFrozen) {
                return NextResponse.json({ error: "Your deployment access has been frozen." }, { status: 403 });
            }

            const body = await req.json();
            const newSubdomain = normalizeSubdomain((body.subdomain as string | undefined) ?? "");
            const newDisplayName = (body.displayName as string | undefined)?.trim().slice(0, 60) || undefined;

            if (newSubdomain === deployment.subdomain) {
                const updated = await tx.deployment.update({
                    where: { id, courseId },
                    data: { displayName: newDisplayName ?? deployment.displayName },
                });
                return NextResponse.json({ deployment: withLiveUrl(updated) });
            }

            const subdomainError = subdomainProblem(newSubdomain);
            if (subdomainError) {
                return NextResponse.json({ error: subdomainError }, { status: 400 });
            }

            // Deployment subdomains are a platform-wide namespace — check
            // across ALL courses, not just the caller's.
            const conflict = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx2) =>
                tx2.deployment.findUnique({ where: { subdomain: newSubdomain } })
            );
            if (conflict) {
                return NextResponse.json({ error: `The subdomain "${newSubdomain}" is already taken. Please choose another one.` }, { status: 409 });
            }

            const studentSitesBase = await studentSitesDir();
            const oldDir = deployment.folderPath;
            const newDir = safeChildDir(studentSitesBase, newSubdomain);

            if (!fs.existsSync(oldDir)) {
                return NextResponse.json({ error: "This site's files are missing on the server. Delete it and deploy again." }, { status: 409 });
            }
            // No deployment owns newSubdomain (checked above), so a folder
            // there is a leftover from an earlier failed upload.
            if (fs.existsSync(newDir)) await removeDir(newDir);

            try {
                await rename(oldDir, newDir);
            } catch {
                await mkdir(newDir, { recursive: true });
                fs.cpSync(oldDir, newDir, { recursive: true });
                await rm(oldDir, { recursive: true, force: true });
            }

            const newLiveUrl = buildLiveUrl(newSubdomain);

            const updated = await tx.deployment.update({
                where: { id, courseId },
                data: {
                    subdomain: newSubdomain,
                    folderPath: newDir,
                    liveUrl: newLiveUrl,
                    displayName: newDisplayName ?? deployment.displayName,
                },
            });

            const newIndexPath = path.join(newDir, "index.html");
            if (fs.existsSync(newIndexPath)) {
                await injectTrackingPixel(newIndexPath, id);
            }

            return NextResponse.json({ deployment: withLiveUrl(updated) });
        });
    } catch (error) {
        console.error("[Deployments PATCH]", error);
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── DELETE /api/deployments/[id] ────────────────────────────────────────────

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const deployment = await tx.deployment.findUnique({ where: { id, courseId } });
            if (!deployment) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });

            const adminCaller = isAdmin(user);
            const isOwner = deployment.userId === user.id;

            if (!adminCaller && !isOwner) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            if (!adminCaller && isOwner) {
                const dbUser = await tx.user.findUnique({
                    where: { id: user.id },
                    select: { isDeploymentFrozen: true },
                });
                if (dbUser?.isDeploymentFrozen) {
                    return NextResponse.json({ error: "Your deployment access has been frozen." }, { status: 403 });
                }
            }

            const folderPath = deployment.folderPath;
            if (fs.existsSync(folderPath)) {
                await rm(folderPath, { recursive: true, force: true });
            }

            await tx.deployment.delete({ where: { id, courseId } });

            return NextResponse.json({ success: true });
        });
    } catch (error) {
        console.error("[Deployments DELETE]", error);
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
