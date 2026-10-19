import "server-only";
import path from "path";
import * as fs from "fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import unzipper from "unzipper";
import type { Prisma } from "@prisma/client";
import {
    DEFAULT_STUDENT_QUOTA_MB,
    MAX_SITE_UNCOMPRESSED_MB,
    MAX_ZIP_ENTRIES,
    buildSiteUrl,
    decodeHtmlBytes,
    formatBytes,
    isBlockedSiteFile,
    isJunkZipPath,
    isUnsafeZipPath,
    resolveZipLayout,
    scanHtmlForRisks,
} from "./deploymentRules";

/**
 * Server-side storage, URL and access helpers for student mini-site
 * deployments. Shared by the /api/deployments routes and user deletion.
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

export function studentQuotaBytes(): number {
    const mb = parseInt(process.env.DEPLOY_STUDENT_QUOTA_MB || "", 10);
    return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_STUDENT_QUOTA_MB) * 1024 * 1024;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

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
        throw new DeploymentError("Invalid path.", 400);
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

/** Removes a deployment's folder, but only if it really lives under student-sites/. */
export async function removeSiteFolder(folderPath: string): Promise<void> {
    if (!folderPath) return;
    const sitesDir = await studentSitesDir();
    let resolved = path.resolve(folderPath);
    if (!resolved.startsWith(sitesDir + path.sep)) {
        // Stored before a storage-path change — same folder name, new base.
        resolved = path.resolve(sitesDir, path.basename(folderPath));
        if (!resolved.startsWith(sitesDir + path.sep)) return;
    }
    await removeDir(resolved);
}

export async function dirSize(dir: string): Promise<number> {
    let total = 0;
    let entries: fs.Dirent[];
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return 0;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) total += await dirSize(full);
        else if (entry.isFile()) total += (await stat(full).catch(() => ({ size: 0 }))).size;
    }
    return total;
}

/** Moves a finished staging folder into place, replacing whatever is there. */
export async function swapIntoPlace(stagingDir: string, targetDir: string): Promise<void> {
    if (!fs.existsSync(targetDir)) {
        await rename(stagingDir, targetDir);
        return;
    }
    const old = `${targetDir}.old-${randomUUID()}`;
    await rename(targetDir, old);
    try {
        await rename(stagingDir, targetDir);
    } catch (err) {
        await rename(old, targetDir).catch(() => {});
        throw err;
    }
    await removeDir(old);
}

// ─── Building a site ──────────────────────────────────────────────────────────

export interface BuiltSite {
    sizeBytes: number;
    riskFlags: string[];
    /** SVG/XML files that were left out. */
    skippedFiles: string[];
}

export async function writeHtmlSite(bytes: Buffer, targetDir: string): Promise<void> {
    // Always store UTF-8 — the site is served with charset=utf-8.
    await writeFile(path.join(targetDir, "index.html"), decodeHtmlBytes(bytes), "utf-8");
}

/**
 * Extracts a site ZIP into targetDir, flattening a single wrapping folder and
 * making sure the main page ends up as targetDir/index.html. SVG/XML files
 * are skipped (see isBlockedSiteFile).
 *
 * Reads the central directory (unzipper.Open) rather than streaming local
 * headers: the streaming parser can stall on archives written with data
 * descriptors and resolved before the last file had been flushed.
 */
export async function extractZipSite(buffer: Buffer, targetDir: string): Promise<string[]> {
    let directory: unzipper.CentralDirectory;
    try {
        directory = await unzipper.Open.buffer(buffer);
    } catch {
        throw new DeploymentError("ZIP ফাইলটি নষ্ট অথবা আসল ZIP নয়। ফোল্ডারে রাইট-ক্লিক করে Compress / Send to → Compressed (zipped) folder দিয়ে আবার zip করে আপলোড করুন।");
    }

    const entries = directory.files;
    if (entries.length > MAX_ZIP_ENTRIES) {
        throw new DeploymentError(`ZIP-এ ${entries.length}টি ফাইল আছে — সর্বোচ্চ ${MAX_ZIP_ENTRIES}টি দেওয়া যাবে। node_modules, .git বা অপ্রয়োজনীয় ফোল্ডার বাদ দিয়ে আবার চেষ্টা করুন।`);
    }
    if (entries.some((e) => e.flags & 0x1)) {
        throw new DeploymentError("ZIP ফাইলটিতে পাসওয়ার্ড দেওয়া আছে। পাসওয়ার্ড ছাড়া আবার zip করুন।");
    }
    const totalSize = entries.reduce((sum, e) => sum + (e.uncompressedSize || 0), 0);
    if (totalSize > MAX_SITE_UNCOMPRESSED_MB * 1024 * 1024) {
        throw new DeploymentError(`ZIP খুললে ${formatBytes(totalSize)} হয় — একটা সাইট সর্বোচ্চ ${MAX_SITE_UNCOMPRESSED_MB}MB হতে পারে। বড় ভিডিও বা অপ্রয়োজনীয় ফাইল বাদ দিন।`);
    }

    const resolved = resolveZipLayout(entries.map((e) => ({ path: e.path, isDirectory: e.type === "Directory" })));
    if ("error" in resolved) throw new DeploymentError(resolved.error);
    const { rootPrefix, indexPath, blockedFiles } = resolved.layout;

    for (const entry of entries) {
        if (entry.type === "Directory") continue;
        const entryPath = entry.path.replace(/\\/g, "/").replace(/^\.\//, "");
        if (isJunkZipPath(entryPath) || isUnsafeZipPath(entryPath) || isBlockedSiteFile(entryPath)) continue;
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
            throw new DeploymentError(`ZIP থেকে "${entryPath}" পড়া যাচ্ছে না — ফাইলটি নষ্ট হতে পারে। কম্পিউটারের নিজস্ব "Compress" অপশন দিয়ে আবার zip করুন।`);
        }
        await mkdir(path.dirname(destPath), { recursive: true });
        if (relative === "index.html") {
            await writeFile(destPath, decodeHtmlBytes(content), "utf-8");
        } else {
            await writeFile(destPath, content);
        }
    }

    if (!fs.existsSync(path.join(targetDir, "index.html"))) {
        throw new DeploymentError("ZIP-এর ভেতরে একটা index.html পেজ থাকতে হবে।");
    }
    return blockedFiles;
}

async function scanSiteForRisks(dir: string): Promise<string[]> {
    const host = new URL(appOrigin()).host;
    const flags = new Set<string>();
    const walk = async (d: string): Promise<void> => {
        const entries = await readdir(d, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) await walk(full);
            else if (/\.html?$/i.test(e.name)) {
                const html = await readFile(full, "utf-8").catch(() => "");
                for (const f of scanHtmlForRisks(html, host)) flags.add(f);
            }
        }
    };
    await walk(dir);
    return [...flags];
}

/** Writes an uploaded .html or .zip into stagingDir and measures/scans the result. */
export async function buildSite(kind: "html" | "zip", buffer: Buffer, stagingDir: string): Promise<BuiltSite> {
    let skippedFiles: string[] = [];
    if (kind === "html") await writeHtmlSite(buffer, stagingDir);
    else skippedFiles = await extractZipSite(buffer, stagingDir);
    const [sizeBytes, riskFlags] = await Promise.all([dirSize(stagingDir), scanSiteForRisks(stagingDir)]);
    return { sizeBytes, riskFlags, skippedFiles };
}

// ─── Access ───────────────────────────────────────────────────────────────────

export const DEFAULT_DEPLOYMENT_LIMIT = 5;

export interface DeploymentAccess {
    /** Why the student can't create/update/rename sites right now, or null. */
    blockedReason: string | null;
    limit: number;
    used: number;
    usedBytes: number;
    quotaBytes: number;
    isFrozen: boolean;
    batchCompleted: boolean;
    deployAfterBatchEnd: boolean;
}

/**
 * Everything that decides whether a student may deploy. A completed
 * (archived) batch blocks deploys automatically — computed here rather than
 * stored, so re-activating the batch restores access with no extra step —
 * unless an admin granted this student deployAfterBatchEnd.
 */
export async function getDeploymentAccess(
    tx: Prisma.TransactionClient,
    courseId: string,
    userId: string
): Promise<DeploymentAccess> {
    const [user, deployments] = await Promise.all([
        tx.user.findUnique({
            where: { id: userId },
            select: { deploymentLimit: true, isDeploymentFrozen: true, deployAfterBatchEnd: true, studentBatchName: true },
        }),
        tx.deployment.findMany({
            where: { courseId, userId },
            select: { id: true, folderPath: true, sizeBytes: true },
        }),
    ]);

    let batchCompleted = false;
    if (user?.studentBatchName) {
        const batch = await tx.batch.findUnique({
            where: { courseId_name: { courseId, name: user.studentBatchName } },
            select: { status: true },
        });
        batchCompleted = batch?.status === "archived";
    }

    // Sites deployed before sizes were recorded: measure once and remember.
    let usedBytes = 0;
    for (const d of deployments) {
        let size = d.sizeBytes;
        if (!size) {
            size = await dirSize(d.folderPath);
            if (size) await tx.deployment.update({ where: { id: d.id }, data: { sizeBytes: size } });
        }
        usedBytes += size;
    }

    const limit = user?.deploymentLimit ?? DEFAULT_DEPLOYMENT_LIMIT;
    const isFrozen = user?.isDeploymentFrozen ?? false;
    const deployAfterBatchEnd = user?.deployAfterBatchEnd ?? false;

    let blockedReason: string | null = null;
    if (isFrozen) {
        blockedReason = "অ্যাডমিন আপনার ডিপ্লয়মেন্ট অ্যাক্সেস বন্ধ (freeze) করে রেখেছেন। আপনার ইনস্ট্রাক্টরের সাথে যোগাযোগ করুন।";
    } else if (batchCompleted && !deployAfterBatchEnd) {
        blockedReason = "আপনার ব্যাচ শেষ (completed) হয়ে গেছে, তাই নতুন সাইট ডিপ্লয় বা আপডেট করা বন্ধ। আগের সাইটগুলো লাইভ থাকবে। দরকার হলে ইনস্ট্রাক্টরের কাছে অনুমতি চান।";
    }

    return { blockedReason, limit, used: deployments.length, usedBytes, quotaBytes: studentQuotaBytes(), isFrozen, batchCompleted, deployAfterBatchEnd };
}

export function quotaProblem(access: DeploymentAccess, newSiteBytes: number, replacingBytes = 0): string | null {
    const after = access.usedBytes - replacingBytes + newSiteBytes;
    if (after <= access.quotaBytes) return null;
    return `আপনার সব সাইট মিলিয়ে সর্বোচ্চ ${formatBytes(access.quotaBytes)} জায়গা পাবেন। এখন ব্যবহার করছেন ${formatBytes(access.usedBytes)}, নতুন সাইটটি ${formatBytes(newSiteBytes)} — জায়গা হচ্ছে না। পুরোনো কোনো সাইট ডিলিট করুন বা ছবি/ভিডিও ছোট করুন।`;
}

// ─── Cleanup when accounts go away ────────────────────────────────────────────

/**
 * Folder paths of every deployment matching `where`. Collect these inside the
 * delete transaction and pass them to removeSiteFolder once it commits, so a
 * rolled-back delete never loses files.
 */
export async function listDeploymentFolders(
    tx: Prisma.TransactionClient,
    where: Prisma.DeploymentWhereInput
): Promise<string[]> {
    const rows = await tx.deployment.findMany({ where, select: { folderPath: true } });
    return rows.map((r) => r.folderPath);
}

/**
 * Finds folders in student-sites/ that no deployment row points at — left
 * behind by older deletes, crashes or aborted uploads — and removes them.
 * Staging folders younger than an hour are left alone (an upload may be in
 * progress).
 */
export async function removeOrphanSiteFolders(knownFolders: string[]): Promise<string[]> {
    const sitesDir = await studentSitesDir();
    // Match on the folder name too: rows written before a storage-path change
    // hold a different absolute prefix for the same folder.
    const known = new Set(knownFolders.flatMap((f) => [path.resolve(f), path.basename(f)]));
    const orphans: string[] = [];
    const entries = (await readdir(sitesDir, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory());
    for (const e of entries) {
        const full = path.join(sitesDir, e.name);
        if (known.has(full) || known.has(e.name)) continue;
        if (e.name.startsWith(".staging-") || e.name.includes(".old-")) {
            const age = Date.now() - (await stat(full).catch(() => ({ mtimeMs: Date.now() }))).mtimeMs;
            if (age < 60 * 60 * 1000) continue;
        }
        orphans.push(e.name);
    }

    // A wrong or empty row list (bad env, DB hiccup) must not wipe every
    // live site. Real orphans trickle in a few at a time.
    if (orphans.length > Math.max(20, entries.length / 2)) {
        console.error(`[Deployments] orphan cleanup aborted: ${orphans.length} of ${entries.length} folders unmatched — check the deployments table/storage path`);
        return [];
    }
    for (const name of orphans) await removeDir(path.join(sitesDir, name));
    return orphans;
}
