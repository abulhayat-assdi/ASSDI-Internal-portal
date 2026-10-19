import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getSessionUserFromRequestOrBearer } from "@/lib/auth";
import { checkUserQuota, verifyFileSignature, verifyHomeworkFile } from "@/lib/uploadGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Returns the base directory for stored files.
 * Uses LOCAL_STORAGE_PATH (Docker volume) → UPLOAD_DIR → <cwd>/public fallback.
 */
function getStorageBase(): string {
    const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR;
    if (configured) {
        return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
    }
    return path.resolve(process.cwd(), "public");
}

/**
 * POST /api/storage/upload
 * FormData: { file, category (homework|resource|quiz), path (optional) }
 */
export async function POST(request: NextRequest) {
    const sessionUser = await getSessionUserFromRequestOrBearer(request);
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const category = (formData.get("category") as string) || "resource";
        const subPath = formData.get("path") as string;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const ALLOWED_EXTENSIONS = new Set([
            ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp",
            ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
            ".csv", ".txt", ".zip", ".mp4", ".mp3",
            // .html/.htm and .svg execute script, so they are excluded for
            // general uploads. Homework is the exception (students submit
            // landing pages): it is content-scanned below and served back from
            // a sandboxed, script-isolated response (see /api/file).
        ]);
        const HOMEWORK_ONLY_EXTENSIONS = new Set([".html", ".htm", ".svg"]);

        const ext = path.extname(file.name).toLowerCase();
        const allowedHere =
            ALLOWED_EXTENSIONS.has(ext) || (category === "homework" && HOMEWORK_ONLY_EXTENSIONS.has(ext));
        if (!allowedHere) {
            return NextResponse.json(
                {
                    error: `এই ফাইল টাইপ গ্রহণযোগ্য নয় (${ext || "no extension"})। অনুমোদিত: ছবি, PDF, Word, Excel, PowerPoint, ZIP${category === "homework" ? ", HTML, SVG" : ""}।`,
                },
                { status: 400 }
            );
        }

        if (file.size > 100 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large (Max 100MB)" }, { status: 400 });
        }

        const storageBase = getStorageBase();
        const timestamp = Date.now();
        const safeName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        let storagePath: string;
        if (category === "homework") {
            storagePath = `uploads/homework/${sessionUser.id}/${safeName}`;
        } else if (category === "quiz") {
            storagePath = `uploads/quiz/${sessionUser.id}/${safeName}`;
        } else {
            const folder = subPath ? subPath.replace(/[^a-zA-Z0-9_]/g, "_") : "";
            storagePath = folder
                ? `uploads/resources/${folder}/${safeName}`
                : `uploads/resources/${safeName}`;
        }

        const absolutePath = path.join(storageBase, storagePath);
        const dir = path.dirname(absolutePath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // The extension and the browser-supplied MIME type are both caller
        // input; the bytes are not. Reject a .png that is really a script.
        const signatureError =
            category === "homework"
                ? verifyHomeworkFile(buffer, file.name)
                : verifyFileSignature(buffer, file.name);
        if (signatureError) {
            return NextResponse.json({ error: signatureError }, { status: 400 });
        }

        const quotaError = checkUserQuota(sessionUser.id, buffer.length);
        if (quotaError) {
            return NextResponse.json({ error: quotaError }, { status: 413 });
        }

        fs.writeFileSync(absolutePath, buffer);

        console.log(`[Upload] ${category} saved → ${absolutePath}`);

        return NextResponse.json({
            success: true,
            fileUrl: `/${storagePath}`,
            storagePath,
            fileName: file.name,
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[Upload] Error:", msg);
        return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
    }
}
