export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { mkdir, rm, readFile, writeFile, rename } from "fs/promises";
import path from "path";
import * as fs from "fs";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import * as cheerio from "cheerio";

function getStorageBase(): string {
    const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR || "./storage";
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd";

const RESERVED_SUBDOMAINS = new Set([
    "www", "api", "admin", "mail", "portal", "app", "cdn", "ftp",
    "smtp", "imap", "pop", "dev", "staging", "test", "demo", "static",
    "assets", "media", "img", "images", "upload", "uploads",
]);

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

function buildLiveUrl(subdomain: string): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${BASE_DOMAIN}`;
    return `${appUrl}/site/${subdomain}`;
}

function safePath(baseDir: string, subdomain: string): string {
    const resolved = path.resolve(baseDir, subdomain);
    if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
        throw new Error("Invalid path: directory traversal detected.");
    }
    return resolved;
}

async function injectTrackingPixel(indexHtmlPath: string, deploymentId: string): Promise<void> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${BASE_DOMAIN}`;
    try {
        const html = await readFile(indexHtmlPath, "utf-8");
        const $ = cheerio.load(html);
        $(`img[data-asm-pixel]`).remove();
        const pixelTag = `<img src="${appUrl}/api/deployments/pixel?id=${deploymentId}" width="1" height="1" style="position:absolute;opacity:0;pointer-events:none" alt="" aria-hidden="true" data-asm-pixel="1">`;
        if ($("body").length) {
            $("body").append(pixelTag);
        } else {
            $.root().append(pixelTag);
        }
        await writeFile(indexHtmlPath, $.html(), "utf-8");
    } catch {
        console.warn(`[Deployments] Could not inject tracking pixel into ${indexHtmlPath}`);
    }
}

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
            const newSubdomain = (body.subdomain as string | undefined)?.toLowerCase().trim();
            const newDisplayName = (body.displayName as string | undefined)?.trim();

            if (!newSubdomain) {
                return NextResponse.json({ error: "New subdomain is required." }, { status: 400 });
            }

            if (!SUBDOMAIN_REGEX.test(newSubdomain)) {
                return NextResponse.json({ error: "Invalid subdomain format." }, { status: 400 });
            }
            if (RESERVED_SUBDOMAINS.has(newSubdomain)) {
                return NextResponse.json({ error: `"${newSubdomain}" is a reserved subdomain.` }, { status: 400 });
            }

            if (newSubdomain === deployment.subdomain) {
                const updated = await tx.deployment.update({
                    where: { id, courseId },
                    data: { displayName: newDisplayName ?? deployment.displayName },
                });
                return NextResponse.json({ deployment: updated });
            }

            // Deployment subdomains are a platform-wide namespace — check
            // across ALL courses, not just the caller's.
            const conflict = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx2) =>
                tx2.deployment.findUnique({ where: { subdomain: newSubdomain } })
            );
            if (conflict) {
                return NextResponse.json({ error: "This subdomain is already taken." }, { status: 409 });
            }

            const storageBase = getStorageBase();
            const studentSitesBase = path.resolve(storageBase, "student-sites");
            const oldDir = deployment.folderPath;
            const newDir = safePath(studentSitesBase, newSubdomain);

            if (fs.existsSync(newDir)) {
                return NextResponse.json({ error: "A site with this subdomain already exists on the server." }, { status: 409 });
            }

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

            return NextResponse.json({ deployment: updated });
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
