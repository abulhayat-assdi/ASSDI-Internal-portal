export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { withCourseContext } from "@/lib/db";
import path from "path";
import fs from "fs";

// POST /api/admin/logo — upload site logo, saves to public/images/logo/
export async function POST(req: NextRequest) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]);
        if (!ALLOWED.has(file.type)) {
            return NextResponse.json({ error: "Only image files allowed (JPG, PNG, GIF, WebP, SVG)" }, { status: 400 });
        }

        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
        }

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Delete old logo file if exists
            const existingRecord = await tx.cmsContent.findUnique({ where: { courseId_key: { courseId, key: "site_settings" } } });
            if (existingRecord) {
                const existingValue = existingRecord.value as Record<string, unknown>;
                const oldStoragePath = existingValue.logoStoragePath as string;
                if (oldStoragePath && (oldStoragePath.startsWith("uploads/images/logo/") || oldStoragePath.startsWith("images/logo/"))) {
                    const oldAbsPath = path.resolve(process.cwd(), "public", oldStoragePath);
                    if (fs.existsSync(oldAbsPath)) {
                        fs.unlinkSync(oldAbsPath);
                    }
                }
            }

            // Save new logo to public/uploads/images/logo/
            const ext = path.extname(file.name).toLowerCase();
            const timestamp = Date.now();
            const safeExt = ext || ".png";
            const fileName = `logo_${timestamp}${safeExt}`;
            const storagePath = `uploads/images/logo/${fileName}`;
            const absolutePath = path.resolve(process.cwd(), "public", storagePath);
            const dir = path.dirname(absolutePath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            fs.writeFileSync(absolutePath, buffer);

            const logoUrl = `/api/file?path=${storagePath}`;

            // Update site_settings in DB
            const currentValue = existingRecord
                ? (existingRecord.value as Record<string, unknown>)
                : {};

            const updatedValue = {
                ...currentValue,
                logoUrl,
                logoStoragePath: storagePath,
            };

            await tx.cmsContent.upsert({
                where: { courseId_key: { courseId, key: "site_settings" } },
                create: { courseId, key: "site_settings", value: updatedValue, updatedBy: caller.id },
                update: { value: updatedValue, updatedBy: caller.id },
            });

            return NextResponse.json({ success: true, logoUrl, storagePath });
        });
    } catch (error) {
        console.error("[Logo API] Error:", error);
        return NextResponse.json({ error: "Logo upload failed" }, { status: 500 });
    }
}

// DELETE /api/admin/logo — remove current logo, revert to SVG
export async function DELETE(req: NextRequest) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = caller.courseId;

        await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const existingRecord = await tx.cmsContent.findUnique({ where: { courseId_key: { courseId, key: "site_settings" } } });
            if (existingRecord) {
                const existingValue = existingRecord.value as Record<string, unknown>;
                const oldStoragePath = existingValue.logoStoragePath as string;
                if (oldStoragePath && (oldStoragePath.startsWith("uploads/images/logo/") || oldStoragePath.startsWith("images/logo/"))) {
                    const oldAbsPath = path.resolve(process.cwd(), "public", oldStoragePath);
                    if (fs.existsSync(oldAbsPath)) {
                        fs.unlinkSync(oldAbsPath);
                    }
                }

                const updatedValue = { ...existingValue, logoUrl: "", logoStoragePath: "" };
                await tx.cmsContent.update({
                    where: { courseId_key: { courseId, key: "site_settings" } },
                    data: { value: updatedValue, updatedBy: caller.id },
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Logo API] DELETE Error:", error);
        return NextResponse.json({ error: "Failed to remove logo" }, { status: 500 });
    }
}
