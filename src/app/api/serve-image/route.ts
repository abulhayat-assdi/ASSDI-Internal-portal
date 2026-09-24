import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { isPublicStoredPath, normalizeStoredPath, resolveStoredFile } from "@/lib/fileAccess";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_MIME: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
};

/**
 * GET /api/serve-image?p=images/instructors/filename.jpg
 *
 * Deliberately unauthenticated — it backs public branding and instructor
 * photos — so it is restricted to the public prefixes only. It used to serve
 * anything image-shaped under public/, which included students' uploaded
 * homework images (public/homework/<uid>/*.webp).
 *
 * .svg is not in the MIME table on purpose: an SVG runs script in the
 * browser, and these files are user-uploaded.
 */
export async function GET(req: NextRequest) {
    const relPath = normalizeStoredPath(req.nextUrl.searchParams.get("p") ?? "");
    if (!relPath || !isPublicStoredPath(relPath)) {
        return new NextResponse("Not found", { status: 404 });
    }

    const contentType = IMAGE_MIME[path.extname(relPath).toLowerCase()];
    if (!contentType) {
        return new NextResponse("Not found", { status: 404 });
    }

    const file = resolveStoredFile(relPath);
    if (!file) {
        return new NextResponse("Not found", { status: 404 });
    }

    try {
        const buffer = await readFile(file.absolutePath);
        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return new NextResponse("Not found", { status: 404 });
    }
}
