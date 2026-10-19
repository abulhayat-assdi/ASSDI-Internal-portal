export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import * as fs from "fs";
import { rename } from "fs/promises";
import { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import {
    fileSizeProblem,
    fileTypeProblem,
    htmlContentProblem,
    normalizeSubdomain,
    subdomainProblem,
    uploadKind,
} from "@/lib/deploymentRules";
import {
    DeploymentError,
    buildLiveUrl,
    extractZipSite,
    injectTrackingPixel,
    makeStagingDir,
    removeDir,
    safeChildDir,
    siteBaseUrl,
    studentSitesDir,
    withLiveUrl,
    writeHtmlSite,
} from "@/lib/deploymentSite";

const DEFAULT_DEPLOYMENT_LIMIT = 5;

function errorJson(error: string, status: number) {
    return NextResponse.json({ error }, { status });
}

// ─── GET /api/deployments ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return errorJson("Your session has expired. Please log in again.", 401);
    }
    const courseId = user.courseId;

    try {
        const { deployments, dbUser } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const [deployments, dbUser] = await Promise.all([
                tx.deployment.findMany({
                    where: { courseId, userId: user.id },
                    orderBy: { createdAt: "desc" },
                }),
                tx.user.findUnique({
                    where: { id: user.id },
                    select: { deploymentLimit: true, isDeploymentFrozen: true },
                }),
            ]);
            return { deployments, dbUser };
        });

        return NextResponse.json({
            deployments: deployments.map(withLiveUrl),
            deploymentLimit: dbUser?.deploymentLimit ?? DEFAULT_DEPLOYMENT_LIMIT,
            isDeploymentFrozen: dbUser?.isDeploymentFrozen ?? false,
            siteBaseUrl: siteBaseUrl(),
        });
    } catch (error) {
        console.error("[Deployments GET]", error);
        return errorJson("Could not load your deployments. Please refresh the page.", 500);
    }
}

// ─── POST /api/deployments ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return errorJson("Your session has expired. Please log in again, then deploy.", 401);
    }
    const courseId = user.courseId;

    let stagingDir: string | null = null;
    try {
        const { dbUser, existingCount } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const [dbUser, existingCount] = await Promise.all([
                tx.user.findUnique({
                    where: { id: user.id },
                    select: { deploymentLimit: true, isDeploymentFrozen: true },
                }),
                tx.deployment.count({ where: { courseId, userId: user.id } }),
            ]);
            return { dbUser, existingCount };
        });

        if (dbUser?.isDeploymentFrozen) {
            return errorJson("Your deployment access has been frozen by an administrator. Please contact your instructor.", 403);
        }

        const limit = dbUser?.deploymentLimit ?? DEFAULT_DEPLOYMENT_LIMIT;
        if (existingCount >= limit) {
            return errorJson(
                `You already have ${existingCount} of ${limit} allowed sites. Delete an old site from My Deployments to deploy a new one.`,
                429
            );
        }

        let formData: FormData;
        try {
            formData = await req.formData();
        } catch (err) {
            console.error("[Deployments POST] formData", err);
            return errorJson(
                "The upload did not reach the server completely (the connection may have dropped). Check your internet connection and try again.",
                400
            );
        }

        const fileField = formData.get("file");
        const file = fileField instanceof File ? fileField : null;
        const rawSubdomain = normalizeSubdomain((formData.get("subdomain") as string | null) ?? "");
        const displayName = ((formData.get("displayName") as string | null) ?? "").trim().slice(0, 60);

        if (!file) return errorJson("No file was uploaded. Select an .html or .zip file.", 400);

        const subdomainError = subdomainProblem(rawSubdomain);
        if (subdomainError) return errorJson(subdomainError, 400);

        const typeError = fileTypeProblem(file.name);
        if (typeError) return errorJson(typeError, 400);
        const sizeError = fileSizeProblem(file.size);
        if (sizeError) return errorJson(sizeError, 413);
        const kind = uploadKind(file.name)!;

        // Deployment subdomains are a platform-wide namespace (separate from
        // course subdomains), so this check intentionally looks across ALL
        // courses, not just the caller's.
        const existing = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
            tx.deployment.findUnique({ where: { subdomain: rawSubdomain }, select: { id: true } })
        );
        if (existing) {
            return errorJson(`The subdomain "${rawSubdomain}" is already taken. Please choose another one.`, 409);
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        if (kind === "html") {
            const htmlError = htmlContentProblem(buffer);
            if (htmlError) return errorJson(htmlError, 422);
        }

        // Build the site in a staging folder and only move it into place once
        // it's complete — a failed or aborted upload used to leave a folder
        // behind that blocked the subdomain ("already exists on the server")
        // even though no deployment existed.
        const sitesDir = await studentSitesDir();
        const targetDir = safeChildDir(sitesDir, rawSubdomain);
        stagingDir = await makeStagingDir(sitesDir);

        if (kind === "html") {
            await writeHtmlSite(buffer, stagingDir);
        } else {
            await extractZipSite(buffer, stagingDir);
        }

        // No DB row owns this subdomain (checked above), so anything on disk
        // is a leftover from an earlier failed attempt.
        if (fs.existsSync(targetDir)) await removeDir(targetDir);
        await rename(stagingDir, targetDir);
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
                return errorJson(`The subdomain "${rawSubdomain}" was just taken by someone else. Please choose another one.`, 409);
            }
            throw err;
        }

        await injectTrackingPixel(path.join(targetDir, "index.html"), deployment.id);

        return NextResponse.json({ deployment, liveUrl }, { status: 201 });
    } catch (error) {
        if (stagingDir) await removeDir(stagingDir);
        if (error instanceof DeploymentError) {
            return errorJson(error.message, error.status);
        }
        console.error("[Deployments POST]", error);
        return errorJson("Something went wrong on the server while deploying. Please try again in a minute; if it keeps failing, contact your instructor.", 500);
    }
}
