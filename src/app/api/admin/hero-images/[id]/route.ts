export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import path from "path";
import fs from "fs";

// PUT /api/admin/hero-images/[id] — update label, order, isActive
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const { id } = await params;
        const body = await req.json();
        const { label, order, isActive } = body;

        const updated = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.heroImage.update({
                where: { id, courseId },
                data: {
                    ...(label !== undefined && { label: label || null }),
                    ...(order !== undefined && { order }),
                    ...(isActive !== undefined && { isActive }),
                },
            })
        );

        return NextResponse.json({ success: true, image: updated });
    } catch (error) {
        console.error("[Hero Images API] PUT Error:", error);
        return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
    }
}

// DELETE /api/admin/hero-images/[id] — delete DB record + file from disk
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const { id } = await params;

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Check minimum: don't allow deleting if it's the last active image
            const totalActive = await tx.heroImage.count({ where: { courseId, isActive: true } });
            const imageToDelete = await tx.heroImage.findUnique({ where: { id, courseId } });

            if (!imageToDelete) {
                return { error: "Image not found" as const, status: 404 };
            }

            if (imageToDelete.isActive && totalActive <= 1) {
                return { error: "Cannot delete the last active hero image" as const, status: 400 };
            }

            // Delete the DB record first
            await tx.heroImage.delete({ where: { id, courseId } });

            return { imageToDelete };
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        // Delete file from disk (only if it's an uploaded hero — don't delete seeded originals in images/home/)
        const { imageToDelete } = result;
        if (imageToDelete.storagePath.startsWith("uploads/images/hero/") || imageToDelete.storagePath.startsWith("images/hero/")) {
            const absolutePath = path.resolve(process.cwd(), "public", imageToDelete.storagePath);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Hero Images API] DELETE Error:", error);
        return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
    }
}
