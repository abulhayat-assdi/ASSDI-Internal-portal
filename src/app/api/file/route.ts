import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import {
    authorizeFileRead,
    isPublicStoredPath,
    normalizeStoredPath,
    resolveStoredFile,
    servingHeadersFor,
} from "@/lib/fileAccess";
import { streamFileResponse } from "@/lib/fileStream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * [API Route] Serve files from local VPS storage
 * GET /api/file?path=uploads/homework/{uid}/file.pdf   (private, auth required)
 * GET /api/file?path=uploads/resources/folder/file.pdf (private, auth required)
 *
 * Authorization and path resolution both live in @/lib/fileAccess so this
 * route agrees with /api/uploads. It previously resolved only against
 * public/, which in production (LOCAL_STORAGE_PATH=/app/storage) meant its
 * homework ownership check guarded a directory the files weren't even in.
 */
export async function GET(request: NextRequest) {
    const relPath = normalizeStoredPath(request.nextUrl.searchParams.get("path") ?? "");
    if (!relPath) {
        return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    const user = isPublicStoredPath(relPath) ? null : await getSessionUser(request);
    const decision = await authorizeFileRead(relPath, user);
    if (!decision.allowed) {
        return NextResponse.json(
            { error: decision.status === 401 ? "Unauthorized" : "Forbidden" },
            { status: decision.status }
        );
    }

    const file = await resolveStoredFile(relPath);
    if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    try {
        const fileName = path.basename(file.absolutePath);
        // Range-aware so videos can seek and big PDFs load progressively.
        return streamFileResponse(request.headers.get("range"), file.absolutePath, file.size, {
            ...servingHeadersFor(file.absolutePath, relPath),
            "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
            "Cache-Control": decision.isPublic
                ? "public, max-age=31536000, immutable"
                : "private, no-store",
            "X-Content-Type-Options": "nosniff",
        });
    } catch (error) {
        console.error("[File API] Stream Error:", error);
        return NextResponse.json({ error: "Error reading file" }, { status: 500 });
    }
}
