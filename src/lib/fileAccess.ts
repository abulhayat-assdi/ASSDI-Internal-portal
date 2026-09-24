import "server-only";
import path from "path";
import fs from "fs";
import { withCourseContext } from "./db";
import type { JWTPayload } from "./auth";

/**
 * Central authorization + path resolution for every stored file.
 *
 * Uploads land on disk under a single storage base (a Docker volume in
 * production, ./public in local dev) and are served back through several
 * routes: /api/uploads/[...path], /api/file, /api/serve-image and
 * /api/storage/delete. Each of those used to carry its own ad-hoc traversal
 * and ownership checks, which disagreed with each other. They now all go
 * through this module so a path is normalized *before* any ownership rule is
 * applied to it — the ordering the old checks got wrong, letting
 * `resources/../homework/<victim>/f.pdf` slip past a `startsWith("homework/")`
 * test and be served to anyone.
 */

/** Where uploads are written. Mirrors the getStorageBase() in the upload routes. */
export function getStorageBase(): string {
    const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR;
    if (configured) {
        return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
    }
    return path.resolve(process.cwd(), "public");
}

/** The legacy base: files written before LOCAL_STORAGE_PATH existed live here. */
function getFallbackBase(): string {
    return path.resolve(process.cwd(), "public");
}

/**
 * Collapses a caller-supplied path into a canonical, relative, traversal-free
 * form (`a/b/c.pdf`). Returns null if it escapes the root or is empty, so a
 * caller can never turn `..` into an ownership-check bypass.
 */
export function normalizeStoredPath(input: string): string | null {
    if (!input) return null;

    // %2e%2e style encodings arrive already decoded via searchParams/params,
    // but a NUL byte would still truncate the path at the fs layer.
    if (input.includes("\0")) return null;

    const withoutQuery = input.split("?")[0].split("#")[0];
    const unprefixed = withoutQuery
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/^(api\/uploads\/|uploads\/|storage\/(public|private)\/)/, "");

    // path.posix.normalize resolves any `..` segments that survived above.
    const normalized = path.posix.normalize(unprefixed);
    if (!normalized || normalized === "." || normalized === "/") return null;
    if (normalized.startsWith("..") || normalized.startsWith("/")) return null;
    if (normalized.split("/").includes("..")) return null;

    return normalized;
}

/**
 * Prefixes that are genuinely public: site branding, instructor photos and
 * the shared CV template artwork. Everything else needs a session.
 */
const PUBLIC_PREFIXES = ["images/", "uploads/cv-templates/", "cv-templates/"];

/** Prefixes holding one student's private work, keyed by owner id. */
const OWNER_SCOPED_PREFIXES = ["uploads/homework/", "homework/"];

export function isPublicStoredPath(normalizedPath: string): boolean {
    return PUBLIC_PREFIXES.some((p) => normalizedPath.startsWith(p));
}

/** `uploads/homework/<ownerId>/file.pdf` → `<ownerId>`, else null. */
function ownerIdFor(normalizedPath: string): string | null {
    const prefix = OWNER_SCOPED_PREFIXES.find((p) => normalizedPath.startsWith(p));
    if (!prefix) return null;
    const ownerId = normalizedPath.slice(prefix.length).split("/")[0];
    return ownerId || null;
}

export type FileAccessDecision =
    | { allowed: true; isPublic: boolean }
    | { allowed: false; status: 401 | 403 };

/**
 * Decides whether `user` may read `normalizedPath`.
 *
 * - public prefixes: anyone,
 * - homework: the owning student, or staff belonging to the owner's course,
 * - anything else: any signed-in user.
 *
 * The last rule is deliberately coarse. Files outside homework carry no
 * course marker on disk, so this stops anonymous internet access but does not
 * yet isolate one course's resources from another's — tracked separately.
 */
export async function authorizeFileRead(
    normalizedPath: string,
    user: JWTPayload | null
): Promise<FileAccessDecision> {
    if (isPublicStoredPath(normalizedPath)) return { allowed: true, isPublic: true };

    if (!user) return { allowed: false, status: 401 };

    const ownerId = ownerIdFor(normalizedPath);
    if (!ownerId) return { allowed: true, isPublic: false };

    if (user.id === ownerId) return { allowed: true, isPublic: false };

    const role = (user.role || "").toLowerCase();
    if (role === "super_admin") return { allowed: true, isPublic: false };
    if (role !== "admin" && role !== "teacher") return { allowed: false, status: 403 };

    // Staff may only reach homework belonging to a student in their own course.
    const owner = await withCourseContext(
        { courseId: user.courseId ?? null, isSuperAdmin: false },
        (tx) => tx.user.findUnique({ where: { id: ownerId }, select: { courseId: true } })
    ).catch(() => null);

    if (!owner || !user.courseId || owner.courseId !== user.courseId) {
        return { allowed: false, status: 403 };
    }
    return { allowed: true, isPublic: false };
}

/** Same rules as reading, plus: only staff and the owner may delete. */
export async function authorizeFileDelete(
    normalizedPath: string,
    user: JWTPayload | null
): Promise<FileAccessDecision> {
    if (!user) return { allowed: false, status: 401 };

    const role = (user.role || "").toLowerCase();
    const isStaff = role === "admin" || role === "teacher" || role === "super_admin";
    const ownerId = ownerIdFor(normalizedPath);

    if (ownerId && user.id === ownerId) return { allowed: true, isPublic: false };
    if (!isStaff) return { allowed: false, status: 403 };

    // Staff deleting someone's homework still has to share their course.
    if (ownerId) return authorizeFileRead(normalizedPath, user);
    return { allowed: true, isPublic: false };
}

export interface ResolvedFile {
    absolutePath: string;
    size: number;
}

/**
 * Finds `normalizedPath` on disk under one of the allowed bases, re-checking
 * containment after resolution. Tries the storage volume first, then the
 * legacy public/ directory, with and without the `uploads/` prefix — the four
 * shapes the various upload routes have written over time.
 */
export function resolveStoredFile(normalizedPath: string): ResolvedFile | null {
    const bases = [getStorageBase(), getFallbackBase()];
    const relatives = [normalizedPath, `uploads/${normalizedPath}`];

    for (const base of bases) {
        for (const rel of relatives) {
            const absolutePath = path.resolve(base, rel);
            // Defence in depth: normalizeStoredPath already rejects traversal.
            if (absolutePath !== base && !absolutePath.startsWith(base + path.sep)) continue;
            try {
                const stat = fs.statSync(absolutePath);
                if (stat.isFile()) return { absolutePath, size: stat.size };
            } catch {
                // Not here — try the next candidate.
            }
        }
    }
    return null;
}

const MIME_TYPES: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
};

/**
 * Content type for a stored file. Note the deliberate omissions: .svg and
 * .html are never served with their real type, because both execute script in
 * the browser under this origin and students can upload them.
 */
export function contentTypeFor(absolutePath: string): string {
    return MIME_TYPES[path.extname(absolutePath).toLowerCase()] ?? "application/octet-stream";
}
