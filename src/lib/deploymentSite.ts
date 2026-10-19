import "server-only";
import path from "path";
import * as fs from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import * as cheerio from "cheerio";
import unzipper from "unzipper";
import {
    MAX_ZIP_ENTRIES,
    MAX_ZIP_UNCOMPRESSED_MB,
    buildSiteUrl,
    decodeHtmlBytes,
    isJunkZipPath,
    isUnsafeZipPath,
    resolveZipLayout,
} from "./deploymentRules";

/**
 * Server-side storage and URL helpers for student mini-site deployments.
 * Shared by POST /api/deployments and PATCH/DELETE /api/deployments/[id].
 */

/** An error whose message is safe and useful to show the student as-is. */
export class DeploymentError extends Error {
    constructor(message: string, readonly status = 422) {
        super(message);
    }
}

// Server-side: prefer the runtime BASE_DOMAIN (NEXT_PUBLIC_* is baked in at
// build time and would ignore the deployed environment). See lib/course.ts.
function baseDomain(): string {
    return process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd";
}

function appOrigin(): string {
    return (process.env.NEXT_PUBLIC_APP_URL || `https://${baseDomain()}`).replace(/\/+$/, "");
}

/** "https://<main domain>/site" — every deployment lives at <this>/<subdomain>. */
export function siteBaseUrl(): string {
    return `${appOrigin()}/site`;
}

export function buildLiveUrl(subdomain: string): string {
    return buildSiteUrl(siteBaseUrl(), subdomain);
}

/**
 * Rows created before the /site/<subdomain> switch still hold the old
 * <subdomain>.<domain> URL, so the stored value isn't trusted for display.
 */
export function withLiveUrl<T extends { subdomain: string; liveUrl: string }>(d: T): T {
    return { ...d, liveUrl: buildLiveUrl(d.subdomain) };
}

export function pixelUrl(deploymentId: string): string {
    return `${appOrigin()}/api/deployments/pixel?id=${deploymentId}`;
}

function getStorageBase(): string {
    const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR || "./storage";
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

export async function studentSitesDir(): Promise<string> {
    const dir = path.resolve(getStorageBase(), "student-sites");
    await mkdir(dir, { recursive: true });
    return dir;
}

export function safeChildDir(baseDir: string, name: string): string {
    const resolved = path.resolve(baseDir, name);
    if (!resolved.startsWith(baseDir + path.sep)) {
        throw new DeploymentError("Invalid path: directory traversal detected.", 400);
    }
    return resolved;
}

/** A scratch directory beside the final one, so a half-written site never sits at a live path. */
export async function makeStagingDir(sitesDir: string): Promise<string> {
    const dir = path.join(sitesDir, `.staging-${randomUUID()}`);
    await mkdir(dir, { recursive: true });
    return dir;
}

export async function removeDir(dir: string): Promise<void> {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
}

export async function writeHtmlSite(bytes: Buffer, targetDir: string): Promise<void> {
    // Always store UTF-8 — the site is served with charset=utf-8.
    await writeFile(path.join(targetDir, "index.html"), decodeHtmlBytes(bytes), "utf-8");
}

/**
 * Extracts a site ZIP into targetDir, flattening a single wrapping folder and
 * making sure the main page ends up as targetDir/index.html.
 *
 * Reads the central directory (unzipper.Open) rather than streaming local
 * headers: the streaming parser hangs on archives written with data
 * descriptors (macOS Finder, many Android apps) and resolved before the last
 * file had been flushed, which made the index.html check fail at random.
 */
export async function extractZipSite(buffer: Buffer, targetDir: string): Promise<void> {
    let directory: unzipper.CentralDirectory;
    try {
        directory = await unzipper.Open.buffer(buffer);
    } catch {
        throw new DeploymentError("This ZIP file is damaged or not a real ZIP archive. Re-create it (right-click the folder → Compress / Send to → Compressed (zipped) folder) and upload again.");
    }

    const entries = directory.files;
    if (entries.length > MAX_ZIP_ENTRIES) {
        throw new DeploymentError(`The ZIP has ${entries.length} files — the maximum is ${MAX_ZIP_ENTRIES}. Remove node_modules, .git or other unused folders and try again.`);
    }
    if (entries.some((e) => e.flags & 0x1)) {
        throw new DeploymentError("This ZIP is password-protected. Create it again without a password.");
    }
    const totalSize = entries.reduce((sum, e) => sum + (e.uncompressedSize || 0), 0);
    if (totalSize > MAX_ZIP_UNCOMPRESSED_MB * 1024 * 1024) {
        throw new DeploymentError(`The ZIP expands to more than ${MAX_ZIP_UNCOMPRESSED_MB}MB. Remove large videos or unused files and try again.`);
    }

    const resolved = resolveZipLayout(entries.map((e) => ({ path: e.path, isDirectory: e.type === "Directory" })));
    if ("error" in resolved) throw new DeploymentError(resolved.error);
    const { rootPrefix, indexPath } = resolved.layout;

    for (const entry of entries) {
        if (entry.type === "Directory") continue;
        const entryPath = entry.path.replace(/\\/g, "/").replace(/^\.\//, "");
        if (isJunkZipPath(entryPath) || isUnsafeZipPath(entryPath)) continue;
        if (!entryPath.startsWith(rootPrefix)) continue;

        let relative = entryPath.slice(rootPrefix.length);
        if (relative === indexPath) relative = "index.html";
        if (!relative) continue;

        const destPath = path.resolve(targetDir, relative);
        if (!destPath.startsWith(targetDir + path.sep)) continue;

        let content: Buffer;
        try {
            content = await entry.buffer();
        } catch {
            throw new DeploymentError(`Could not read "${entryPath}" from the ZIP — the archive may be damaged or use an unsupported compression method. Re-create it with your system's built-in "Compress" option.`);
        }
        await mkdir(path.dirname(destPath), { recursive: true });
        if (relative === "index.html") {
            await writeFile(destPath, decodeHtmlBytes(content), "utf-8");
        } else {
            await writeFile(destPath, content);
        }
    }

    if (!fs.existsSync(path.join(targetDir, "index.html"))) {
        throw new DeploymentError("The ZIP must contain an index.html page.");
    }
}

export async function injectTrackingPixel(indexHtmlPath: string, deploymentId: string): Promise<void> {
    try {
        const html = await readFile(indexHtmlPath, "utf-8");
        const $ = cheerio.load(html);
        $(`img[data-asm-pixel]`).remove();
        const pixelTag = `<img src="${pixelUrl(deploymentId)}" width="1" height="1" style="position:absolute;opacity:0;pointer-events:none" alt="" aria-hidden="true" data-asm-pixel="1">`;
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
