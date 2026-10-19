// ============================================================
// deploymentRules.ts — rules shared by the student deploy form and the
// deployment API, so both sides reject the same things with the same words.
// Pure functions only: this file is imported from client components.
// Student-facing messages are in Bengali.
// ============================================================

export const MAX_DEPLOY_SIZE_MB = 50;
export const MAX_ZIP_ENTRIES = 500;
/** Uncompressed size of one site — a guard against zip bombs and disk hogs. */
export const MAX_SITE_UNCOMPRESSED_MB = 100;
/** Default total disk space one student's sites may use (overridable via DEPLOY_STUDENT_QUOTA_MB). */
export const DEFAULT_STUDENT_QUOTA_MB = 150;

export const RESERVED_SUBDOMAINS = new Set([
    "www", "api", "admin", "mail", "portal", "app", "cdn", "ftp",
    "smtp", "imap", "pop", "dev", "staging", "test", "demo", "static",
    "assets", "media", "img", "images", "upload", "uploads", "site", "sites",
]);

export const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/**
 * File types a deployed site may not contain. SVG and XML documents can carry
 * script that runs under the portal's own domain when opened directly, and a
 * landing page doesn't need them (use PNG/WebP for logos and icons).
 */
const BLOCKED_SITE_EXTENSIONS = [".svg", ".svgz", ".xml", ".xhtml", ".xht", ".xsl", ".xslt"];

export function isBlockedSiteFile(p: string): boolean {
    const lower = p.toLowerCase();
    return BLOCKED_SITE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Turns whatever the student typed into a candidate subdomain. */
export function normalizeSubdomain(raw: string): string {
    return raw.toLowerCase().trim();
}

/** Returns a human-readable reason the subdomain is unusable, or null if it's fine. */
export function subdomainProblem(subdomain: string): string | null {
    const s = normalizeSubdomain(subdomain);
    if (!s) return "সাবডোমেইন লিখুন।";
    if (s.length < 3) return "সাবডোমেইন কমপক্ষে ৩ অক্ষরের হতে হবে।";
    if (s.length > 63) return "সাবডোমেইন সর্বোচ্চ ৬৩ অক্ষরের হতে পারবে।";
    if (/[^a-z0-9-]/.test(s)) return "শুধু ছোট হাতের ইংরেজি অক্ষর (a-z), সংখ্যা (0-9) আর হাইফেন (-) দেওয়া যাবে — স্পেস, ডট (.) বা অন্য কোনো চিহ্ন নয়।";
    if (s.startsWith("-") || s.endsWith("-")) return "সাবডোমেইনের শুরুতে বা শেষে হাইফেন (-) দেওয়া যাবে না।";
    if (!SUBDOMAIN_REGEX.test(s)) return "সাবডোমেইনটি সঠিক নয়।";
    if (RESERVED_SUBDOMAINS.has(s)) return `"${s}" নামটি সিস্টেমের জন্য সংরক্ষিত। অন্য নাম দিন।`;
    return null;
}

/** Live URL shape: <origin>/site/<subdomain>. */
export function buildSiteUrl(siteBaseUrl: string, subdomain: string): string {
    return `${siteBaseUrl.replace(/\/+$/, "")}/${subdomain}`;
}

export type UploadKind = "html" | "zip";

/** Decides by extension (case-insensitive) — browsers report MIME types inconsistently, especially on Windows and Android. */
export function uploadKind(fileName: string): UploadKind | null {
    const name = fileName.toLowerCase().trim();
    if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
    if (name.endsWith(".zip")) return "zip";
    return null;
}

export function fileTypeProblem(fileName: string): string | null {
    if (uploadKind(fileName)) return null;
    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase() : "";
    if (ext === ".rar" || ext === ".7z" || ext === ".tar" || ext === ".gz") {
        return `"${fileName}" একটি ${ext} ফাইল। শুধু .zip সাপোর্ট করে — ফোল্ডারটি আবার .zip করে আপলোড করুন।`;
    }
    return `"${fileName}" ফাইলটি সাপোর্ট করে না। একটি .html ফাইল অথবা প্রজেক্ট ফোল্ডারের .zip ফাইল আপলোড করুন।`;
}

export function fileSizeProblem(sizeBytes: number): string | null {
    if (sizeBytes === 0) return "ফাইলটি খালি (0 bytes)।";
    if (sizeBytes > MAX_DEPLOY_SIZE_MB * 1024 * 1024) {
        return `ফাইলের সাইজ ${formatBytes(sizeBytes)} — সর্বোচ্চ ${MAX_DEPLOY_SIZE_MB}MB দেওয়া যাবে। ছবি/ভিডিও কমপ্রেস করুন বা অপ্রয়োজনীয় ফাইল বাদ দিয়ে আবার চেষ্টা করুন।`;
    }
    return null;
}

/**
 * Decodes an HTML file's bytes. Windows Notepad's "Unicode" option saves
 * UTF-16, which browsers then render as garbage when served as UTF-8 — so
 * this honours the BOM and the server re-saves the page as UTF-8.
 */
export function decodeHtmlBytes(bytes: Uint8Array): string {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
    return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}

function hasUtf16Bom(bytes: Uint8Array): boolean {
    return bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff));
}

/**
 * Checks that an uploaded .html file actually holds an HTML page. Works on
 * the raw bytes so the browser (File) and the server (Buffer) agree.
 */
export function htmlContentProblem(bytes: Uint8Array): string | null {
    if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
        return "ফাইলের নাম .html হলেও এটা আসলে একটা ZIP ফাইল। নাম বদলে .zip করে আবার আপলোড করুন।";
    }
    if (!hasUtf16Bom(bytes) && bytes.subarray(0, 4096).includes(0)) {
        return "এটা টেক্সট HTML ফাইল নয় (ভেতরে বাইনারি ডেটা আছে)। শর্টকাট বা ডকুমেন্ট নয়, আসল .html ফাইলটি আপলোড করুন।";
    }
    const trimmed = decodeHtmlBytes(bytes).trim();
    if (!trimmed) return "HTML ফাইলটি খালি।";
    if (!/<[a-z!][^>]*>/i.test(trimmed)) {
        return "এই ফাইলে কোনো HTML ট্যাগ নেই। নিশ্চিত হোন এটা আসল HTML পেজ (এতে <html>, <head>, <body> ইত্যাদি থাকে)।";
    }
    if (/^<\?php/i.test(trimmed)) {
        return "PHP ফাইল এখানে চলবে না — শুধু HTML/CSS/JS দিয়ে বানানো স্ট্যাটিক সাইট ডিপ্লয় করা যায়।";
    }
    return null;
}

// ─── ZIP layout ───────────────────────────────────────────────────────────────

export interface ZipEntryInfo {
    /** Path inside the archive, using "/" separators. */
    path: string;
    isDirectory: boolean;
}

export interface ZipLayout {
    /** Prefix (with trailing "/", or "") to strip from every entry so the site root becomes the deploy root. */
    rootPrefix: string;
    /** Path of the page to serve as index.html, relative to rootPrefix. */
    indexPath: string;
    /** SVG/XML files inside the site that will be left out. */
    blockedFiles: string[];
}

/** OS junk that zip tools add and that should never be deployed. */
export function isJunkZipPath(p: string): boolean {
    const parts = p.split("/");
    return parts.some((part) => part === "__MACOSX" || part === ".DS_Store" || part === "Thumbs.db" || part === "desktop.ini")
        || parts.some((part) => part.startsWith("._"));
}

export function isUnsafeZipPath(p: string): boolean {
    return p.startsWith("/") || /^[a-zA-Z]:/.test(p) || p.split("/").some((part) => part === "..");
}

/**
 * Works out where the site lives inside the archive. Students very often zip
 * the *folder* (so everything sits under "my-site/"), name the page
 * "Index.html" on Windows, or have a single page with another name — all of
 * which used to fail with "ZIP must contain an index.html file at its root".
 */
export function resolveZipLayout(entries: ZipEntryInfo[]): { layout: ZipLayout } | { error: string } {
    const files = entries
        .filter((e) => !e.isDirectory)
        .map((e) => e.path.replace(/\\/g, "/").replace(/^\.\//, ""))
        .filter((p) => p && !isJunkZipPath(p) && !isUnsafeZipPath(p));

    if (files.length === 0) {
        return { error: "ZIP ফাইলটি খালি — ভেতরে কোনো ফাইল নেই।" };
    }

    const htmlFiles = files.filter((p) => /\.html?$/i.test(p));
    if (htmlFiles.length === 0) {
        return { error: "ZIP-এর ভেতরে কোনো .html ফাইল নেই। আপনার প্রজেক্টে একটা index.html পেজ থাকতে হবে।" };
    }

    const depth = (p: string) => p.split("/").length;
    const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
    const baseOf = (p: string) => p.slice(p.lastIndexOf("/") + 1);
    const blockedUnder = (prefix: string) => files.filter((p) => p.startsWith(prefix) && isBlockedSiteFile(p));

    // 1. The shallowest index.html / index.htm (any letter case).
    const indexes = htmlFiles
        .filter((p) => /^index\.html?$/i.test(baseOf(p)))
        .sort((a, b) => depth(a) - depth(b) || (/\.html$/i.test(a) ? -1 : 1));
    if (indexes.length > 0) {
        const best = indexes[0];
        const sameDepth = indexes.filter((p) => depth(p) === depth(best) && dirOf(p) !== dirOf(best));
        if (sameDepth.length > 0) {
            return {
                error: `ZIP-এর ভেতরে একাধিক সাইট আছে (${[best, ...sameDepth].slice(0, 3).join(", ")})। একবারে শুধু একটা প্রজেক্ট ফোল্ডার zip করুন।`,
            };
        }
        const rootPrefix = dirOf(best);
        return { layout: { rootPrefix, indexPath: baseOf(best), blockedFiles: blockedUnder(rootPrefix) } };
    }

    // 2. No index page, but exactly one HTML page at the shallowest level — serve it as the index.
    const minDepth = Math.min(...htmlFiles.map(depth));
    const shallowest = htmlFiles.filter((p) => depth(p) === minDepth);
    if (shallowest.length === 1) {
        const page = shallowest[0];
        const rootPrefix = dirOf(page);
        return { layout: { rootPrefix, indexPath: baseOf(page), blockedFiles: blockedUnder(rootPrefix) } };
    }

    return {
        error: `ZIP-এ index.html নেই। পাওয়া গেছে: ${shallowest.slice(0, 4).map(baseOf).join(", ")}${shallowest.length > 4 ? " …" : ""} — আপনার মূল পেজের নাম index.html করে আবার zip করুন।`,
    };
}

/** Student-facing note about SVG/XML files that were left out. */
export function blockedFilesNote(blocked: string[]): string | null {
    if (blocked.length === 0) return null;
    const names = blocked.slice(0, 3).map((p) => p.slice(p.lastIndexOf("/") + 1)).join(", ");
    return `নিরাপত্তার কারণে SVG/XML ফাইল ডিপ্লয় করা হয় না, তাই ${blocked.length}টি ফাইল বাদ যাবে (${names}${blocked.length > 3 ? " …" : ""})। লোগো/আইকনের জন্য PNG বা WebP ব্যবহার করুন।`;
}

// ─── Risk scan ────────────────────────────────────────────────────────────────

/**
 * Looks for patterns typical of phishing pages. Nothing is blocked — matches
 * are stored on the deployment so an admin can review it.
 */
export function scanHtmlForRisks(html: string, siteHost: string): string[] {
    const flags = new Set<string>();
    if (/<input[^>]+type\s*=\s*["']?password/i.test(html)) flags.add("password-field");

    const actionRe = /<form[^>]+action\s*=\s*["']?\s*(https?:)?\/\/([^/"'\s>]+)/gi;
    for (const m of html.matchAll(actionRe)) {
        const host = m[2].toLowerCase();
        if (host !== siteHost.toLowerCase()) { flags.add(`external-form:${host}`); }
    }

    const text = html.toLowerCase();
    const brands = ["bkash", "nagad", "rocket", "dutch-bangla", "facebook login", "gmail", "paypal", "binance"];
    const asksSecret = flags.has("password-field") || /\b(otp|pin\s*(code|number)?|cvv)\b/.test(text);
    if (asksSecret) {
        for (const b of brands) if (text.includes(b)) flags.add(`brand:${b}`);
    }
    return [...flags];
}
