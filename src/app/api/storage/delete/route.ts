import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getSessionUser } from "@/lib/auth";
import { authorizeFileDelete, normalizeStoredPath, resolveStoredFile } from "@/lib/fileAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * [API Route] Physically delete a file from local VPS storage
 * DELETE /api/storage/delete?path=...
 *
 * Ownership is decided on the *normalized* path (see @/lib/fileAccess): the
 * previous version tested the raw string, so `resources/../homework/<victim>/x`
 * failed the `startsWith("homework/")` test and skipped the owner check
 * entirely. It also only ever looked under public/, while uploads land on the
 * storage volume — so deletes silently no-op'd in production.
 */
export async function DELETE(request: NextRequest) {
    const relPath = normalizeStoredPath(request.nextUrl.searchParams.get("path") ?? "");
    if (!relPath) {
        return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    const sessionUser = await getSessionUser(request);
    const decision = await authorizeFileDelete(relPath, sessionUser);
    if (!decision.allowed) {
        if (decision.status === 403) {
            console.warn(`[Delete API] Forbidden attempt by ${sessionUser?.id} to delete ${relPath}`);
        }
        return NextResponse.json(
            { error: decision.status === 401 ? "Unauthorized" : "Forbidden" },
            { status: decision.status }
        );
    }

    const file = resolveStoredFile(relPath);
    if (!file) {
        // Not on disk — report success so the caller can still drop its DB row.
        console.warn(`[Delete API] File not found on disk: ${relPath}`);
        return NextResponse.json({ success: true, message: "File not found on disk" });
    }

    try {
        fs.unlinkSync(file.absolutePath);
        console.log(`[Delete API] File deleted: ${relPath}`);
        return NextResponse.json({ success: true, message: "File deleted" });
    } catch (error) {
        console.error("[Delete API] Delete Error:", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}
