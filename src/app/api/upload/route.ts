import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { checkUserQuota, verifyFileSignature } from "@/lib/uploadGuard";

// image/svg+xml is deliberately absent: an SVG is a script-bearing document,
// and these files are served from the portal's own origin.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/x-icon", "image/vnd.microsoft.icon",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "application/x-zip-compressed",
  "video/mp4", "video/webm",
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/** Maps the client's `folder` onto a fixed set of destinations. */
function resolveUploadSubDir(folder: string): string | null {
    if (folder === "routines") return "documents/routines";
    const ALLOWED_FOLDERS = new Set([
        "images/instructors",
        "images/courses",
        "images/home",
        "images/logo",
        "student-leaves",
        "policies",
        "cv-templates",
    ]);
    if (ALLOWED_FOLDERS.has(folder)) return folder;
    // Per-course branding: images/courses/<courseId>
    if (/^images\/courses\/[A-Za-z0-9_-]+$/.test(folder)) return folder;
    return null;
}

function getStorageBase(): string {
    const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR;
    if (configured) {
        return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
    }
    return path.resolve(process.cwd(), "public");
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const folder = (formData.get("folder") as string) || "images/instructors";

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // File type validation
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
        }

        // File size validation
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `File too large. Max 100MB allowed.` }, { status: 400 });
        }

        // `folder` comes from the client, and some prefixes (images/*) are
        // served publicly with no session. Pin it to the set the app actually
        // uses so an uploader can't choose where their file lands.
        const uploadSubDir = resolveUploadSubDir(folder);
        if (!uploadSubDir) {
            return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
        }

        const storageBase = getStorageBase();
        const uploadDir = path.resolve(storageBase, uploadSubDir);
        if (!uploadDir.startsWith(storageBase + path.sep) && uploadDir !== storageBase) {
            return NextResponse.json({ error: "Forbidden: Invalid upload path" }, { status: 403 });
        }

        await mkdir(uploadDir, { recursive: true });

        const cleanFileName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.-]/g, "");
        const uniqueFilename = `${Date.now()}-${cleanFileName}`;
        const filePath = path.join(uploadDir, uniqueFilename);

        const buffer = Buffer.from(await file.arrayBuffer());

        const signatureError = verifyFileSignature(buffer, file.name);
        if (signatureError) {
            return NextResponse.json({ error: signatureError }, { status: 400 });
        }

        const quotaError = checkUserQuota(user.id, buffer.length);
        if (quotaError) {
            return NextResponse.json({ error: quotaError }, { status: 413 });
        }

        await writeFile(filePath, buffer);

        const url = `/api/uploads/${uploadSubDir}/${uniqueFilename}`;
        return NextResponse.json({ url, path: url });
    } catch (error) {
        console.error("Error uploading file:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { url } = await req.json();
        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
        const publicDir = path.join(process.cwd(), "public");
        const filePath = path.resolve(publicDir, cleanUrl);

        // Prevent directory traversal
        if (!filePath.startsWith(publicDir + path.sep)) {
            return NextResponse.json({ error: "Forbidden: Out of bounds" }, { status: 403 });
        }

        try {
            await unlink(filePath);
        } catch (e: any) {
            if (e.code !== "ENOENT") throw e;
            console.warn("File to delete not found, ignoring:", filePath);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting file:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to delete file";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
