// ============================================================
// deploymentRules.ts — rules shared by the student deploy form and the
// deployment API, so both sides reject the same things with the same words.
// Pure functions only: this file is imported from client components.
// ============================================================

export const MAX_DEPLOY_SIZE_MB = 50;
export const MAX_ZIP_ENTRIES = 500;
/** Uncompressed total — a guard against zip bombs. */
export const MAX_ZIP_UNCOMPRESSED_MB = 200;

export const RESERVED_SUBDOMAINS = new Set([
    "www", "api", "admin", "mail", "portal", "app", "cdn", "ftp",
    "smtp", "imap", "pop", "dev", "staging", "test", "demo", "static",
    "assets", "media", "img", "images", "upload", "uploads", "site", "sites",
]);

export const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/** Turns whatever the student typed into a candidate subdomain. */
export function normalizeSubdomain(raw: string): string {
    return raw.toLowerCase().trim();
}

/** Returns a human-readable reason the subdomain is unusable, or null if it's fine. */
export function subdomainProblem(subdomain: string): string | null {
    const s = normalizeSubdomain(subdomain);
    if (!s) return "Subdomain is required.";
    if (s.length < 3) return "Subdomain must be at least 3 characters long.";
    if (s.length > 63) return "Subdomain can be at most 63 characters long.";
    if (/[^a-z0-9-]/.test(s)) return "Only lowercase English letters (a-z), numbers (0-9) and hyphens (-) are allowed — no spaces, dots or other symbols.";
    if (s.startsWith("-") || s.endsWith("-")) return "Subdomain cannot start or end with a hyphen (-).";
    if (!SUBDOMAIN_REGEX.test(s)) return "Invalid subdomain.";
    if (RESERVED_SUBDOMAINS.has(s)) return `"${s}" is reserved by the system. Please choose another name.`;
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
        return `"${fileName}" is a ${ext} archive. Only .zip archives are supported — please re-compress the folder as a .zip file.`;
    }
    return `"${fileName}" is not supported. Upload a single .html file, or a .zip file of your project folder.`;
}

export function fileSizeProblem(sizeBytes: number): string | null {
    if (sizeBytes === 0) return "The selected file is empty (0 bytes).";
    if (sizeBytes > MAX_DEPLOY_SIZE_MB * 1024 * 1024) {
        const mb = (sizeBytes / 1024 / 1024).toFixed(1);
        return `File is ${mb}MB — the maximum is ${MAX_DEPLOY_SIZE_MB}MB. Compress your images/videos or remove unused files and try again.`;
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
        return "This file is named .html but is actually a ZIP archive. Rename it to .zip and upload again.";
    }
    if (!hasUtf16Bom(bytes) && bytes.subarray(0, 4096).includes(0)) {
        return "This file is not a text HTML file (it contains binary data). Make sure you're uploading the .html file itself, not a shortcut or a document.";
    }
    const trimmed = decodeHtmlBytes(bytes).trim();
    if (!trimmed) return "The HTML file is empty.";
    if (!/<[a-z!][^>]*>/i.test(trimmed)) {
        return "This file doesn't contain any HTML tags. Make sure it's a real HTML page (it should contain <html>, <head>, <body> etc.).";
    }
    if (/^<\?php/i.test(trimmed)) {
        return "PHP files can't be hosted here — only static HTML/CSS/JS sites.";
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
        return { error: "The ZIP file is empty — it has no files inside." };
    }

    const htmlFiles = files.filter((p) => /\.html?$/i.test(p));
    if (htmlFiles.length === 0) {
        return { error: "The ZIP has no .html file. Your project needs an index.html page." };
    }

    const depth = (p: string) => p.split("/").length;
    const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
    const baseOf = (p: string) => p.slice(p.lastIndexOf("/") + 1);

    // 1. The shallowest index.html / index.htm (any letter case).
    const indexes = htmlFiles
        .filter((p) => /^index\.html?$/i.test(baseOf(p)))
        .sort((a, b) => depth(a) - depth(b) || (/\.html$/i.test(a) ? -1 : 1));
    if (indexes.length > 0) {
        const best = indexes[0];
        const sameDepth = indexes.filter((p) => depth(p) === depth(best) && dirOf(p) !== dirOf(best));
        if (sameDepth.length > 0) {
            return {
                error: `The ZIP contains more than one site (${[best, ...sameDepth].slice(0, 3).join(", ")}). Zip only one project folder at a time.`,
            };
        }
        const rootPrefix = dirOf(best);
        return { layout: { rootPrefix, indexPath: baseOf(best) } };
    }

    // 2. No index page, but exactly one HTML page at the shallowest level — serve it as the index.
    const minDepth = Math.min(...htmlFiles.map(depth));
    const shallowest = htmlFiles.filter((p) => depth(p) === minDepth);
    if (shallowest.length === 1) {
        const page = shallowest[0];
        return { layout: { rootPrefix: dirOf(page), indexPath: baseOf(page) } };
    }

    return {
        error: `The ZIP has no index.html. Found ${shallowest.slice(0, 4).map(baseOf).join(", ")}${shallowest.length > 4 ? " …" : ""} — rename your main page to index.html and zip again.`,
    };
}
