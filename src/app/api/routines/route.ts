import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import fs from "fs";
import { unlink } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getStorageBase(): string {
    const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR;
    return configured
        ? (path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured))
        : path.resolve(process.cwd(), "public");
}

function resolveRoutineFilePath(storagePath: string): string {
    const clean = storagePath.startsWith("/api/uploads/")
        ? storagePath.replace(/^\/api\/uploads\//, "")
        : storagePath.startsWith("/")
            ? storagePath.slice(1)
            : storagePath;

    const storageBase = getStorageBase();
    const primaryPath = path.resolve(storageBase, clean);
    const fallbackPath = path.resolve(process.cwd(), "public", clean);
    return fs.existsSync(primaryPath) ? primaryPath : fallbackPath;
}

// Best-effort removal of a previously uploaded file from disk.
async function removeUploadedFile(storagePath?: string | null) {
    if (!storagePath) return;
    try {
        const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR;
        const storageBase = configured
            ? (path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured))
            : path.resolve(process.cwd(), "public");
        const clean = storagePath.startsWith("/api/uploads/")
            ? storagePath.replace(/^\/api\/uploads\//, "")
            : storagePath.startsWith("/")
                ? storagePath.slice(1)
                : storagePath;
        const primaryPath = path.resolve(storageBase, clean);
        const fallbackPath = path.resolve(process.cwd(), "public", clean);
        const filePath = await (async () => {
            if (await import("fs/promises").then(m => m.access(primaryPath).then(() => true).catch(() => false))) return primaryPath;
            return fs.existsSync(fallbackPath) ? fallbackPath : primaryPath;
        })();
        const allowedBase = fs.existsSync(primaryPath) ? storageBase : path.resolve(process.cwd(), "public");
        if (!filePath.startsWith(allowedBase + path.sep) && filePath !== allowedBase) return;
        await unlink(filePath);
    } catch (e: any) {
        if (e?.code !== "ENOENT") console.warn("[Routines] could not delete old file:", e?.message);
    }
}

/** GET /api/routines?batchName=...  — latest routine image first */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get("batchName");

    const where: any = { courseId };
    if (batchName) where.batchName = { equals: batchName.trim(), mode: "insensitive" };

    const normalized = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const routines = await tx.routine.findMany({ where, orderBy: { createdAt: "desc" } });

        const existingRoutines = routines.filter((routine) => {
            const filePath = resolveRoutineFilePath(routine.storagePath || routine.fileUrl);
            return fs.existsSync(filePath);
        });

        const missingIds = routines
            .filter((routine) => !existingRoutines.some((item) => item.id === routine.id))
            .map((routine) => routine.id);

        if (missingIds.length > 0) {
            await tx.routine.deleteMany({ where: { id: { in: missingIds }, courseId } });
        }

        return existingRoutines.map(routine => ({
            ...routine,
            fileUrl: routine.fileUrl.startsWith("/api/uploads/")
                ? routine.fileUrl
                : `/api/uploads/${(routine.fileUrl.startsWith("/") ? routine.fileUrl.slice(1) : routine.fileUrl)}`,
        }));
    });

    return NextResponse.json(normalized);
}

/**
 * POST /api/routines — upload/replace the routine image for a batch.
 * Only one image is kept per batch: previous rows (and their files) are removed.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { batchName, fileUrl, storagePath, fileName, uploadedBy } = body;

        if (!batchName || !fileUrl) {
            return NextResponse.json({ error: "batchName and fileUrl are required" }, { status: 400 });
        }

        const routine = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Replace: drop any existing routine(s) for this batch + clean their files.
            const existing = await tx.routine.findMany({ where: { courseId, batchName } });
            if (existing.length > 0) {
                await tx.routine.deleteMany({ where: { courseId, batchName } });
                await Promise.all(existing.map(r => removeUploadedFile(r.storagePath)));
            }

            return tx.routine.create({
                data: {
                    courseId,
                    batchName,
                    fileUrl,
                    storagePath: storagePath || fileUrl,
                    fileName: fileName || "",
                    uploadedBy: uploadedBy || user.id,
                },
            });
        });

        return NextResponse.json(routine, { status: 201 });
    } catch (error) {
        console.error("[Routines POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/routines?id=...  — remove a routine image (and its file) */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const routine = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const routine = await tx.routine.findUnique({ where: { id, courseId } });
        if (routine) {
            await tx.routine.delete({ where: { id, courseId } });
        }
        return routine;
    });

    if (routine) {
        await removeUploadedFile(routine.storagePath);
    }
    return NextResponse.json({ success: true });
}
