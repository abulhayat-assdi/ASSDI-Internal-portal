import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { contentTypeFor, resolveStoredFile } from "@/lib/fileAccess";
import { verifyHomeworkFileLink } from "@/lib/homeworkFileLink";
import { streamFileResponse } from "@/lib/fileStream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/file/shared/{token}/{fileName}
 *
 * Serves the single homework file a signed, 60-minute link grants — no
 * session needed, because Microsoft's Office viewer fetches it from their
 * servers. Office/PDF/media types only: HTML and SVG (which could run script
 * on this origin) are never served here.
 */
const SHAREABLE = new Set([".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".pdf"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; name: string }> }) {
    const { token } = await params;
    const stored = await verifyHomeworkFileLink(token);
    if (!stored) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 403 });

    const ext = path.extname(stored).toLowerCase();
    if (!SHAREABLE.has(ext)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const file = await resolveStoredFile(stored);
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    return streamFileResponse(req.headers.get("range"), file.absolutePath, file.size, {
        "Content-Type": contentTypeFor(file.absolutePath),
        "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(file.absolutePath))}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
    });
}
