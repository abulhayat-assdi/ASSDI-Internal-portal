export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { normalizeSubdomain, subdomainProblem } from "@/lib/deploymentRules";
import {
    RATE_LIMITED,
    SERVER_ERROR,
    UPLOAD_INCOMPLETE,
    deployRateLimited,
    readDeployUpload,
    readFormData,
} from "@/lib/deploymentUpload";
import {
    DeploymentError,
    buildLiveUrl,
    buildSite,
    getDeploymentAccess,
    makeStagingDir,
    quotaProblem,
    removeDir,
    safeChildDir,
    siteBaseUrl,
    studentSitesDir,
    swapIntoPlace,
    withLiveUrl,
} from "@/lib/deploymentSite";

function errorJson(error: string, status: number) {
    return NextResponse.json({ error }, { status });
}

// ─── GET /api/deployments ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return errorJson("আপনার সেশনের মেয়াদ শেষ। আবার লগইন করুন।", 401);
    }
    const courseId = user.courseId;

    try {
        const { deployments, access } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const access = await getDeploymentAccess(tx, courseId, user.id);
            const deployments = await tx.deployment.findMany({
                where: { courseId, userId: user.id },
                orderBy: { createdAt: "desc" },
            });
            return { deployments, access };
        });

        return NextResponse.json({
            deployments: deployments.map(withLiveUrl),
            deploymentLimit: access.limit,
            isDeploymentFrozen: access.isFrozen,
            blockedReason: access.blockedReason,
            usedBytes: access.usedBytes,
            quotaBytes: access.quotaBytes,
            siteBaseUrl: siteBaseUrl(),
        });
    } catch (error) {
        console.error("[Deployments GET]", error);
        return errorJson("ডিপ্লয়মেন্টগুলো লোড করা যাচ্ছে না। পেজটি রিফ্রেশ করুন।", 500);
    }
}

// ─── POST /api/deployments ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return errorJson("আপনার সেশনের মেয়াদ শেষ। আবার লগইন করে ডিপ্লয় করুন।", 401);
    }
    const courseId = user.courseId;

    let stagingDir: string | null = null;
    try {
        const access = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            getDeploymentAccess(tx, courseId, user.id)
        );
        if (access.blockedReason) return errorJson(access.blockedReason, 403);
        if (access.used >= access.limit) {
            return errorJson(
                `আপনার ${access.limit}টি সাইটের সবগুলোই ব্যবহার হয়ে গেছে (${access.used}/${access.limit})। নতুন সাইট দিতে My Deployments থেকে পুরোনো একটা ডিলিট করুন, অথবা আগের কোনো সাইটে "Update files" দিন।`,
                429
            );
        }
        if (deployRateLimited(user.id)) return errorJson(RATE_LIMITED, 429);

        const formData = await readFormData(req);
        if (!formData) return errorJson(UPLOAD_INCOMPLETE, 400);

        const rawSubdomain = normalizeSubdomain((formData.get("subdomain") as string | null) ?? "");
        const displayName = ((formData.get("displayName") as string | null) ?? "").trim().slice(0, 60);

        const subdomainError = subdomainProblem(rawSubdomain);
        if (subdomainError) return errorJson(subdomainError, 400);

        const upload = await readDeployUpload(formData);
        if ("error" in upload) return errorJson(upload.error, upload.status);

        // Deployment subdomains are a platform-wide namespace (separate from
        // course subdomains), so this check intentionally looks across ALL
        // courses, not just the caller's.
        const existing = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
            tx.deployment.findUnique({ where: { subdomain: rawSubdomain }, select: { id: true } })
        );
        if (existing) {
            return errorJson(`"${rawSubdomain}" সাবডোমেইনটি আগেই অন্য কেউ নিয়ে নিয়েছে। অন্য একটা নাম দিন।`, 409);
        }

        // Build the site in a staging folder and only move it into place once
        // it's complete — a failed or aborted upload used to leave a folder
        // behind that blocked the subdomain even though no deployment existed.
        const sitesDir = await studentSitesDir();
        const targetDir = safeChildDir(sitesDir, rawSubdomain);
        stagingDir = await makeStagingDir(sitesDir);
        const built = await buildSite(upload.kind, upload.buffer, stagingDir);

        const overQuota = quotaProblem(access, built.sizeBytes);
        if (overQuota) {
            await removeDir(stagingDir);
            stagingDir = null;
            return errorJson(overQuota, 413);
        }

        // No DB row owns this subdomain (checked above), so anything already
        // on disk is a leftover from an earlier failed attempt.
        if (fs.existsSync(targetDir)) await removeDir(targetDir);
        await swapIntoPlace(stagingDir, targetDir);
        stagingDir = null;

        const liveUrl = buildLiveUrl(rawSubdomain);
        let deployment;
        try {
            deployment = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
                const created = await tx.deployment.create({
                    data: {
                        courseId,
                        userId: user.id,
                        subdomain: rawSubdomain,
                        displayName: displayName || rawSubdomain,
                        folderPath: targetDir,
                        liveUrl,
                        sizeBytes: built.sizeBytes,
                        riskFlags: built.riskFlags,
                    },
                });
                await logActivity(tx, {
                    courseId,
                    actorUid: user.id,
                    actorRole: "STUDENT",
                    actionType: "DEPLOYMENT_CREATED",
                    targetType: "deployment",
                    targetId: created.id,
                    description: `${user.displayName || user.id} "${rawSubdomain}" নামে একটা প্রজেক্ট ডেপ্লয় করেছে`,
                });
                return created;
            });
        } catch (err) {
            await removeDir(targetDir);
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                return errorJson(`"${rawSubdomain}" সাবডোমেইনটি এইমাত্র অন্য কেউ নিয়ে নিয়েছে। অন্য একটা নাম দিন।`, 409);
            }
            throw err;
        }

        return NextResponse.json({ deployment: withLiveUrl(deployment), liveUrl, skippedFiles: built.skippedFiles }, { status: 201 });
    } catch (error) {
        if (stagingDir) await removeDir(stagingDir);
        if (error instanceof DeploymentError) return errorJson(error.message, error.status);
        console.error("[Deployments POST]", error);
        return errorJson(SERVER_ERROR, 500);
    }
}
