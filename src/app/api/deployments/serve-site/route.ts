export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { withCourseContext } from "@/lib/db";

function getStorageBase(): string {
    const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR || "./storage";
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
};

function getTodayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function hashIp(ip: string): string {
    return createHash("sha256").update(ip + (process.env.JWT_SECRET ?? "asm-pixel-salt")).digest("hex");
}

function getClientIp(req: NextRequest): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown"
    );
}

// ─── GET /api/deployments/serve-site?subdomain=xyz&path=/index.html ────────────

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const subdomain = searchParams.get("subdomain")?.toLowerCase().trim();
    let reqPath = searchParams.get("path") || "/";

    if (!subdomain) {
        return new NextResponse("Subdomain required", { status: 400 });
    }

    try {
        const storageBase = getStorageBase();
        const studentSitesDir = path.resolve(storageBase, "student-sites");
        const siteDir = path.resolve(studentSitesDir, subdomain);

        // Security check: path traversal out of site bounds
        if (!siteDir.startsWith(studentSitesDir + path.sep) && siteDir !== studentSitesDir) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Clean requested path
        if (reqPath === "/" || !reqPath) reqPath = "/index.html";

        let targetPath = path.resolve(siteDir, reqPath.startsWith("/") ? reqPath.slice(1) : reqPath);

        // Path traversal check inside site folder
        if (!targetPath.startsWith(siteDir + path.sep) && targetPath !== siteDir) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Check if file exists, or if it's a directory try index.html inside it
        let fileStat;
        try {
            fileStat = await stat(targetPath);
            if (fileStat.isDirectory()) {
                targetPath = path.join(targetPath, "index.html");
                fileStat = await stat(targetPath);
            }
        } catch {
            // If targetPath doesn't exist, try appending .html or fallback to index.html (SPA fallback)
            try {
                const htmlAttempt = targetPath + ".html";
                fileStat = await stat(htmlAttempt);
                targetPath = htmlAttempt;
            } catch {
                try {
                    const fallbackIndex = path.join(siteDir, "index.html");
                    fileStat = await stat(fallbackIndex);
                    targetPath = fallbackIndex;
                } catch {
                    return new NextResponse("404 Not Found", { status: 404 });
                }
            }
        }

        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        const fileBuffer = await readFile(targetPath);

        // If serving HTML, track visit in background
        if (ext === ".html" || ext === ".htm") {
            const clientIp = getClientIp(req);
            const userAgent = req.headers.get("user-agent") ?? undefined;
            const today = getTodayDate();
            const hashedIp = hashIp(clientIp);

            // Find deployment record (super-admin bypass: subdomain is a
            // platform-wide namespace, and an anonymous visitor has no course).
            withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
                const deployment = await tx.deployment.findUnique({ where: { subdomain }, select: { id: true, courseId: true } });
                if (deployment) {
                    await Promise.all([
                        tx.deployment.update({
                            where: { id: deployment.id },
                            data: { totalVisitors: { increment: 1 } },
                        }),
                        tx.visitorLog.create({
                            data: {
                                courseId: deployment.courseId,
                                deploymentId: deployment.id,
                                visitorIp: hashedIp,
                                userAgent,
                                date: today,
                            },
                        }),
                    ]);
                }
            }).catch((err) => console.error("[Serve-Site Analytics]", err));
        }

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400",
            },
        });
    } catch (error) {
        console.error("[Serve-Site]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
