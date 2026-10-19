export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { mkdir, rm, rename } from "fs/promises";
import * as fs from "fs";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { normalizeSubdomain, subdomainProblem } from "@/lib/deploymentRules";
import {
    DeploymentError,
    buildLiveUrl,
    buildSite,
    getDeploymentAccess,
    makeStagingDir,
    quotaProblem,
    removeDir,
    removeSiteFolder,
    safeChildDir,
    studentSitesDir,
    swapIntoPlace,
    withLiveUrl,
} from "@/lib/deploymentSite";
import {
    RATE_LIMITED,
    SERVER_ERROR,
    UPLOAD_INCOMPLETE,
    deployRateLimited,
    readDeployUpload,
    readFormData,
} from "@/lib/deploymentUpload";

function errorJson(error: string, status: number) {
    return NextResponse.json({ error }, { status });
}

const SESSION_EXPIRED = "আপনার সেশনের মেয়াদ শেষ। আবার লগইন করুন।";
const NOT_FOUND = "সাইটটি পাওয়া যায়নি। পেজটি রিফ্রেশ করুন।";

// ─── PATCH /api/deployments/[id] — rename (subdomain / project name) ──────────

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return errorJson(SESSION_EXPIRED, 401);
    const courseId = user.courseId;

    const { id } = await params;

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const deployment = await tx.deployment.findUnique({ where: { id, courseId } });
            if (!deployment) return errorJson(NOT_FOUND, 404);
            if (deployment.userId !== user.id) return errorJson("এই সাইটটি আপনার নয়।", 403);

            const access = await getDeploymentAccess(tx, courseId, user.id);
            if (access.blockedReason) return errorJson(access.blockedReason, 403);

            const body = await req.json().catch(() => ({}));
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
            if (subdomainError) return errorJson(subdomainError, 400);

            // Deployment subdomains are a platform-wide namespace — check
            // across ALL courses, not just the caller's.
            const conflict = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx2) =>
                tx2.deployment.findUnique({ where: { subdomain: newSubdomain } })
            );
            if (conflict) return errorJson(`"${newSubdomain}" সাবডোমেইনটি আগেই অন্য কেউ নিয়ে নিয়েছে। অন্য একটা নাম দিন।`, 409);

            const studentSitesBase = await studentSitesDir();
            const oldDir = deployment.folderPath;
            const newDir = safeChildDir(studentSitesBase, newSubdomain);

            if (!fs.existsSync(oldDir)) {
                return errorJson("এই সাইটের ফাইল সার্ভারে পাওয়া যাচ্ছে না। \"Update files\" দিয়ে আবার ফাইল আপলোড করুন।", 409);
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

            const updated = await tx.deployment.update({
                where: { id, courseId },
                data: {
                    subdomain: newSubdomain,
                    folderPath: newDir,
                    liveUrl: buildLiveUrl(newSubdomain),
                    displayName: newDisplayName ?? deployment.displayName,
                },
            });

            return NextResponse.json({ deployment: withLiveUrl(updated) });
        });
    } catch (error) {
        if (error instanceof DeploymentError) return errorJson(error.message, error.status);
        console.error("[Deployments PATCH]", error);
        return errorJson(SERVER_ERROR, 500);
    }
}

// ─── PUT /api/deployments/[id] — replace the site's files, same URL ───────────

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) return errorJson(SESSION_EXPIRED, 401);
    const courseId = user.courseId;
    const { id } = await params;

    let stagingDir: string | null = null;
    try {
        const { deployment, access } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Access first: it backfills sizeBytes, which the quota check below reads.
            const access = await getDeploymentAccess(tx, courseId, user.id);
            return { access, deployment: await tx.deployment.findUnique({ where: { id, courseId } }) };
        });
        if (!deployment) return errorJson(NOT_FOUND, 404);
        if (deployment.userId !== user.id) return errorJson("এই সাইটটি আপনার নয়।", 403);
        if (access.blockedReason) return errorJson(access.blockedReason, 403);
        if (deployRateLimited(user.id)) return errorJson(RATE_LIMITED, 429);

        const formData = await readFormData(req);
        if (!formData) return errorJson(UPLOAD_INCOMPLETE, 400);
        const upload = await readDeployUpload(formData);
        if ("error" in upload) return errorJson(upload.error, upload.status);

        const sitesDir = await studentSitesDir();
        const targetDir = safeChildDir(sitesDir, deployment.subdomain);
        stagingDir = await makeStagingDir(sitesDir);
        const built = await buildSite(upload.kind, upload.buffer, stagingDir);

        const overQuota = quotaProblem(access, built.sizeBytes, deployment.sizeBytes);
        if (overQuota) {
            await removeDir(stagingDir);
            stagingDir = null;
            return errorJson(overQuota, 413);
        }

        await swapIntoPlace(stagingDir, targetDir);
        stagingDir = null;
        if (deployment.folderPath && deployment.folderPath !== targetDir) await removeSiteFolder(deployment.folderPath);

        const updated = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.deployment.update({
                where: { id, courseId },
                data: { folderPath: targetDir, sizeBytes: built.sizeBytes, riskFlags: built.riskFlags },
            })
        );

        return NextResponse.json({ deployment: withLiveUrl(updated), skippedFiles: built.skippedFiles });
    } catch (error) {
        if (stagingDir) await removeDir(stagingDir);
        if (error instanceof DeploymentError) return errorJson(error.message, error.status);
        console.error("[Deployments PUT]", error);
        return errorJson(SERVER_ERROR, 500);
    }
}

// ─── DELETE /api/deployments/[id] ────────────────────────────────────────────

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return errorJson(SESSION_EXPIRED, 401);
    const courseId = user.courseId;

    const { id } = await params;

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const deployment = await tx.deployment.findUnique({ where: { id, courseId } });
            if (!deployment) return { error: NOT_FOUND, status: 404 };

            const adminCaller = isAdmin(user);
            const isOwner = deployment.userId === user.id;
            if (!adminCaller && !isOwner) return { error: "এই সাইটটি আপনার নয়।", status: 403 };

            // A completed batch still lets students delete (it frees space);
            // only an explicit admin freeze stops it.
            if (!adminCaller) {
                const dbUser = await tx.user.findUnique({ where: { id: user.id }, select: { isDeploymentFrozen: true } });
                if (dbUser?.isDeploymentFrozen) {
                    return { error: "অ্যাডমিন আপনার ডিপ্লয়মেন্ট অ্যাক্সেস বন্ধ করে রেখেছেন।", status: 403 };
                }
            }

            await tx.deployment.delete({ where: { id, courseId } });
            return { folderPath: deployment.folderPath };
        });

        if ("error" in result) return errorJson(result.error!, result.status!);
        // Files go only after the row is gone for good.
        await removeSiteFolder(result.folderPath);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Deployments DELETE]", error);
        return errorJson("সাইটটি ডিলিট করা যায়নি। আবার চেষ্টা করুন।", 500);
    }
}
