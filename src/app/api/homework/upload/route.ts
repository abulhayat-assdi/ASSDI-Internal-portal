import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";
import { getSessionUser } from "@/lib/auth";
import { getStorageBase } from "@/lib/fileAccess";
import { checkUserQuota, verifyHomeworkFile } from "@/lib/uploadGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Allowed MIME types for homework
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/zip",
  "application/x-zip-compressed",
  "text/html",
  "image/svg+xml",
];

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp",
  ".pdf",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".html", ".htm", ".svg",
  ".zip",
]);

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
    const user = await getSessionUser(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    // The extension decides; the browser-reported MIME is only a hint (it is
    // often empty or generic for .html/.svg/.docx) and the content is verified
    // against the extension below.
    const ext = extname(file.name).toLowerCase();
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.type) || file.type === "" || file.type === "application/octet-stream";
    if (!ALLOWED_EXTENSIONS.has(ext) || !mimeOk) {
      return NextResponse.json(
        { error: `এই ফাইল টাইপ গ্রহণযোগ্য নয় (${ext || file.type || "unknown"})। অনুমোদিত: ছবি (JPG, PNG, WEBP), PDF, Word, Excel, PowerPoint, HTML, SVG, ZIP।` },
        { status: 400 }
      );
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `File too large: ${sizeMB}MB. Maximum allowed is 100MB.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const signatureError = verifyHomeworkFile(buffer, file.name);
    if (signatureError) {
      return NextResponse.json({ error: signatureError }, { status: 400 });
    }

    const quotaError = checkUserQuota(user.id, buffer.length);
    if (quotaError) {
      return NextResponse.json({ error: quotaError }, { status: 413 });
    }

    // Sanitize extension
    const originalExt = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const timestamp = Date.now();
    const filename = `${timestamp}.${originalExt || "bin"}`;

    // The owner is the session user, never a client-supplied studentId — the
    // form used to send that field, so anyone could file their upload under
    // another student's folder (and /api/file keys homework access off exactly
    // that folder name).
    const relPath = `uploads/homework/${user.id}/${filename}`;

    // Written to the storage volume, not public/: a standalone build's public/
    // is baked into the image, so anything written there is lost on redeploy.
    const uploadDir = join(getStorageBase(), "uploads", "homework", user.id);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    await writeFile(join(uploadDir, filename), buffer);

    // Served back through the authorizing route, not as a static asset.
    const publicUrl = `/api/file?path=${encodeURIComponent(relPath)}`;

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      filename: filename 
    }, { status: 201 });

  } catch (error) {
    console.error("Homework upload error:", error);
    return NextResponse.json({ error: "Server error during upload. Please try again." }, { status: 500 });
  }
}
