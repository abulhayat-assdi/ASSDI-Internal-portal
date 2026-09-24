export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import { readFile } from "fs/promises";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import unzipper from "unzipper";
import * as fs from "fs";

function getStorageBase(): string {
    const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR || "./storage";
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

// Server-side: prefer the runtime BASE_DOMAIN (NEXT_PUBLIC_* is baked in at
// build time and would ignore the deployed environment). See lib/course.ts.
const BASE_DOMAIN =
    process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd";
const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_DEPLOY_SIZE_MB || "50") * 1024 * 1024;
const MAX_ZIP_ENTRIES = 500;

const RESERVED_SUBDOMAINS = new Set([
    "www", "api", "admin", "mail", "portal", "app", "cdn", "ftp",
    "smtp", "imap", "pop", "dev", "staging", "test", "demo", "static",
    "assets", "media", "img", "images", "upload", "uploads",
]);

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

function validateSubdomain(subdomain: string): { ok: boolean; error?: string } {
    const s = subdomain.toLowerCase().trim();
    if (!SUBDOMAIN_REGEX.test(s)) {
        return { ok: false, error: "Subdomain must be 3-63 characters, lowercase alphanumeric and hyphens only." };
    }
    if (RESERVED_SUBDOMAINS.has(s)) {
        return { ok: false, error: `"${s}" is a reserved subdomain name.` };
    }
    return { ok: true };
}

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

async function extractZip(buffer: Buffer, targetDir: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        let entryCount = 0;
        const stream = unzipper.Parse();
        stream.on("entry", (entry: unzipper.Entry) => {
            entryCount++;
            if (entryCount > MAX_ZIP_ENTRIES) {
                entry.autodrain();
                stream.destroy(new Error("ZIP contains too many files (max 500)."));
                return;
            }

            const entryPath = entry.path.replace(/\\/g, "/");
            if (entryPath.includes("..") || path.isAbsolute(entryPath)) {
                entry.autodrain();
                return;
            }

            const destPath = path.join(targetDir, entryPath);
            if (!destPath.startsWith(targetDir)) {
                entry.autodrain();
                return;
            }

            if (entry.type === "Directory") {
                fs.mkdirSync(destPath, { recursive: true });
                entry.autodrain();
            } else {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                entry.pipe(fs.createWriteStream(destPath));
            }
        });
        stream.on("finish", () => resolve(true));
        stream.on("error", reject);
        stream.end(buffer);
    });
}

// ─── GET /api/deployments ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
            deployments,
            deploymentLimit: dbUser?.deploymentLimit ?? 5,
            isDeploymentFrozen: dbUser?.isDeploymentFrozen ?? false,
        });
    } catch (error) {
        console.error("[Deployments GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// ─── POST /api/deployments ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;

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
            return NextResponse.json({ error: "Your deployment access has been frozen by an administrator." }, { status: 403 });
        }

        const limit = dbUser?.deploymentLimit ?? 5;
        if (existingCount >= limit) {
            return NextResponse.json({ error: `You have reached your deployment limit of ${limit} projects.` }, { status: 429 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const rawSubdomain = (formData.get("subdomain") as string | null)?.toLowerCase().trim() ?? "";
        const displayName = (formData.get("displayName") as string | null)?.trim() ?? "";

        if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

        const subdomainValidation = validateSubdomain(rawSubdomain);
        if (!subdomainValidation.ok) {
            return NextResponse.json({ error: subdomainValidation.error }, { status: 400 });
        }

        // Deployment subdomains are a platform-wide namespace (separate from
        // course subdomains), so this check intentionally looks across ALL
        // courses, not just the caller's.
        const existing = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
            tx.deployment.findUnique({ where: { subdomain: rawSubdomain } })
        );
        if (existing) {
            return NextResponse.json({ error: "This subdomain is already taken. Please choose another." }, { status: 409 });
        }

        const isHtml = file.type === "text/html" || file.name.endsWith(".html");
        const isZip = file.type === "application/zip"
            || file.type === "application/x-zip-compressed"
            || file.type === "application/octet-stream"
            || file.name.endsWith(".zip");

        if (!isHtml && !isZip) {
            return NextResponse.json({ error: "Only .html and .zip files are accepted." }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.` }, { status: 400 });
        }

        const storageBase = getStorageBase();
        const studentSitesBase = path.resolve(storageBase, "student-sites");
        await mkdir(studentSitesBase, { recursive: true });

        const targetDir = safePath(studentSitesBase, rawSubdomain);
        if (fs.existsSync(targetDir)) {
            return NextResponse.json({ error: "A site with this subdomain already exists on the server." }, { status: 409 });
        }
        await mkdir(targetDir, { recursive: true });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        if (isHtml) {
            await writeFile(path.join(targetDir, "index.html"), buffer);
        } else {
            const success = await extractZip(buffer, targetDir);
            if (!success) {
                fs.rmSync(targetDir, { recursive: true, force: true });
                return NextResponse.json({ error: "Failed to extract ZIP file." }, { status: 422 });
            }
            const indexPath = path.join(targetDir, "index.html");
            if (!fs.existsSync(indexPath)) {
                fs.rmSync(targetDir, { recursive: true, force: true });
                return NextResponse.json({ error: "ZIP must contain an index.html file at its root." }, { status: 422 });
            }
        }

        const liveUrl = buildLiveUrl(rawSubdomain);
        const deployment = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.deployment.create({
                data: {
                    courseId,
                    userId: user.id,
                    subdomain: rawSubdomain,
                    displayName: displayName || rawSubdomain,
                    folderPath: targetDir,
                    liveUrl,
                },
            })
        );

        await injectTrackingPixel(path.join(targetDir, "index.html"), deployment.id);

        return NextResponse.json({ deployment, liveUrl }, { status: 201 });
    } catch (error) {
        console.error("[Deployments POST]", error);
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
