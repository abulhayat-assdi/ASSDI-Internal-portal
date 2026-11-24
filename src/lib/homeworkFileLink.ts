import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { normalizeStoredPath } from "@/lib/fileAccess";

/**
 * Short-lived public links to ONE homework file, so Microsoft's Office Online
 * viewer (which fetches the file from the internet, without our cookies) can
 * render Word/Excel/PowerPoint submissions inside the review window.
 *
 * The token is signed with a key derived from JWT_SECRET but distinct from
 * the session key, so a file link can never be replayed as a login session,
 * and a session token is never accepted as a file link.
 */
export const FILE_LINK_TTL_SECONDS = 60 * 60;
const PURPOSE = "homework-file-view";

function linkKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("[HomeworkFileLink] JWT_SECRET is not set.");
    return new TextEncoder().encode(`${secret}::${PURPOSE}`);
}

export async function signHomeworkFileLink(storedPath: string): Promise<string> {
    return new SignJWT({ p: storedPath, purpose: PURPOSE })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${FILE_LINK_TTL_SECONDS}s`)
        .sign(linkKey());
}

/** The stored path the token grants, or null if invalid/expired/tampered. */
export async function verifyHomeworkFileLink(token: string): Promise<string | null> {
    try {
        const { payload } = await jwtVerify(token, linkKey(), { algorithms: ["HS256"] });
        if (payload.purpose !== PURPOSE || typeof payload.p !== "string") return null;
        const normalized = normalizeStoredPath(payload.p);
        return normalized && isHomeworkPath(normalized) ? normalized : null;
    } catch {
        return null;
    }
}

export function isHomeworkPath(normalized: string): boolean {
    return /^(uploads\/)?homework\/[^/]+\/.+/.test(normalized);
}

/**
 * The stored, normalized path of a submission's file, checked to sit inside
 * that student's own homework folder. Accepts the shapes stored over time:
 * a storagePath, an `/api/file?path=…` URL or an `/uploads/…` URL.
 */
export function submissionFilePath(
    file: { storagePath?: string | null; url?: string | null },
    studentUid: string
): string | null {
    let raw = file.storagePath || "";
    if (!raw && file.url) {
        try {
            const url = new URL(file.url, "http://portal.local");
            raw = url.pathname === "/api/file" ? url.searchParams.get("path") || "" : decodeURIComponent(url.pathname);
        } catch {
            return null;
        }
    }
    const normalized = normalizeStoredPath(raw);
    if (!normalized) return null;
    const m = /^(?:uploads\/)?homework\/([^/]+)\//.exec(normalized);
    return m && m[1] === studentUid ? normalized : null;
}
