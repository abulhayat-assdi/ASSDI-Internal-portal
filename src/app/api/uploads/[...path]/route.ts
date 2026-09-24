import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getSessionUser } from "@/lib/auth";
import {
    authorizeFileRead,
    contentTypeFor,
    isPublicStoredPath,
    normalizeStoredPath,
    resolveStoredFile,
} from "@/lib/fileAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/uploads/[...path]
 *
 * Serves uploaded files from the storage volume (output:'standalone' doesn't
 * reliably serve runtime-written public/ files as static assets).
 *
 * This route is reachable two ways — directly, and via the `/uploads/:path*`
 * rewrite in next.config.ts — so it is listed as a public route in the
 * middleware and does its own authorization here, once, for both entry
 * points. Everything except the branding/CV-template prefixes needs a
 * session; homework additionally needs to be the owner or their course staff.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: segments } = await params;
    const relPath = normalizeStoredPath(segments.join("/"));
    if (!relPath) {
        return new NextResponse("Not Found", { status: 404 });
    }

    // Only pay for the session lookup when the path actually needs one.
    const user = isPublicStoredPath(relPath) ? null : await getSessionUser(req);
    const decision = await authorizeFileRead(relPath, user);
    if (!decision.allowed) {
        return new NextResponse(decision.status === 401 ? "Unauthorized" : "Forbidden", {
            status: decision.status,
        });
    }

    const file = resolveStoredFile(relPath);
    if (!file) {
        return new NextResponse("Not Found", { status: 404 });
    }

    const fileName = path.basename(file.absolutePath);
    const fileBuffer = fs.readFileSync(file.absolutePath);

    return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
            "Content-Type": contentTypeFor(file.absolutePath),
            "Content-Length": String(file.size),
            "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
            // Private files must never be cached by a shared proxy — two
            // students behind one school NAT would otherwise swap documents.
            "Cache-Control": decision.isPublic
                ? "public, max-age=31536000, immutable"
                : "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
