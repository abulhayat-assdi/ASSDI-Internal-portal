import "server-only";
import path from "path";
import fs from "fs";
import { getStorageBase } from "./fileAccess";

/**
 * Upload-time content checks.
 *
 * Both the MIME type and the filename come from the client, so neither says
 * anything trustworthy about what's actually in the bytes. These helpers look
 * at the file's own signature instead, and cap how much one account can
 * accumulate.
 */

/** Leading bytes that identify a container format. */
interface Signature {
    /** Byte pattern, with null meaning "any byte". */
    magic: (number | null)[];
    offset?: number;
}

const SIGNATURES: Record<string, Signature[]> = {
    pdf: [{ magic: [0x25, 0x50, 0x44, 0x46] }], // %PDF
    jpg: [{ magic: [0xff, 0xd8, 0xff] }],
    png: [{ magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
    gif: [{ magic: [0x47, 0x49, 0x46, 0x38] }], // GIF8
    // RIFF....WEBP
    webp: [{ magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] }],
    // ....ftyp — MP4/M4A family
    mp4: [{ magic: [null, null, null, null, 0x66, 0x74, 0x79, 0x70] }],
    mp3: [
        { magic: [0x49, 0x44, 0x33] }, // ID3
        { magic: [0xff, 0xfb] },
        { magic: [0xff, 0xf3] },
        { magic: [0xff, 0xf2] },
    ],
    // Every OOXML file (docx/xlsx/pptx) and .zip is a ZIP container.
    zip: [
        { magic: [0x50, 0x4b, 0x03, 0x04] },
        { magic: [0x50, 0x4b, 0x05, 0x06] }, // empty archive
        { magic: [0x50, 0x4b, 0x07, 0x08] }, // spanned
    ],
    // Legacy Office (.doc/.xls/.ppt) — OLE2 compound file.
    ole2: [{ magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
    ico: [{ magic: [0x00, 0x00, 0x01, 0x00] }],
    // EBML header — WebM and Matroska.
    webm: [{ magic: [0x1a, 0x45, 0xdf, 0xa3] }],
};

/** Which signature families each extension is allowed to match. */
const EXTENSION_FAMILIES: Record<string, string[]> = {
    ".pdf": ["pdf"],
    ".jpg": ["jpg"],
    ".jpeg": ["jpg"],
    ".png": ["png"],
    ".gif": ["gif"],
    ".webp": ["webp"],
    ".ico": ["ico"],
    ".mp4": ["mp4"],
    ".webm": ["webm"],
    ".mp3": ["mp3"],
    ".zip": ["zip"],
    ".docx": ["zip"],
    ".xlsx": ["zip"],
    ".pptx": ["zip"],
    ".doc": ["ole2", "zip"],
    ".xls": ["ole2", "zip"],
    ".ppt": ["ole2", "zip"],
};

/**
 * Extensions with no reliable signature. `.csv` and `.txt` are plain text by
 * definition, so there is nothing to match — they're allowed through, and are
 * safe because the serving routes never label them as HTML.
 */
const SIGNATURE_EXEMPT = new Set([".csv", ".txt"]);

function matches(buffer: Buffer, sig: Signature): boolean {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.magic.length) return false;
    return sig.magic.every((byte, i) => byte === null || buffer[offset + i] === byte);
}

/**
 * Checks that the bytes match what the extension claims.
 *
 * Returns an error string, or null when the file is acceptable. An unknown
 * extension is rejected: callers pair this with their own allowlist, so
 * reaching here with something unlisted means the two lists disagree.
 */
export function verifyFileSignature(buffer: Buffer, fileName: string): string | null {
    const ext = path.extname(fileName).toLowerCase();

    if (SIGNATURE_EXEMPT.has(ext)) return null;

    const families = EXTENSION_FAMILIES[ext];
    if (!families) return `File type not allowed: ${ext || "(no extension)"}`;

    const ok = families.some((family) =>
        SIGNATURES[family]?.some((sig) => matches(buffer, sig))
    );

    return ok ? null : `File contents do not match its ${ext} extension.`;
}

/**
 * Total bytes a single account may hold on disk. Generous for coursework,
 * but finite: without it one student can fill the volume and take the whole
 * portal down with it.
 */
export const DEFAULT_USER_QUOTA_BYTES =
    (Number(process.env.USER_STORAGE_QUOTA_MB) || 500) * 1024 * 1024;

function directorySize(dir: string): number {
    let total = 0;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return 0; // Nothing uploaded yet.
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        try {
            if (entry.isDirectory()) total += directorySize(full);
            else if (entry.isFile()) total += fs.statSync(full).size;
        } catch {
            // Raced with a delete — skip it.
        }
    }
    return total;
}

/**
 * Returns an error string when storing `incomingBytes` more for this user
 * would exceed their quota, or null when there is room.
 */
export function checkUserQuota(userId: string, incomingBytes: number): string | null {
    const base = getStorageBase();
    const used =
        directorySize(path.join(base, "uploads", "homework", userId)) +
        directorySize(path.join(base, "uploads", "user", userId));

    if (used + incomingBytes > DEFAULT_USER_QUOTA_BYTES) {
        const limitMb = Math.round(DEFAULT_USER_QUOTA_BYTES / (1024 * 1024));
        const usedMb = Math.round(used / (1024 * 1024));
        return `স্টোরেজ সীমা পূর্ণ (${usedMb}MB / ${limitMb}MB)। পুরোনো ফাইল মুছে আবার চেষ্টা করুন।`;
    }
    return null;
}
