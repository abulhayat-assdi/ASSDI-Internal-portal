export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import path from "path";
import fs from "fs";

// GET /api/admin/hero-images — list all hero images ordered by `order`
export async function GET(req: NextRequest) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const images = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.heroImage.findMany({
                where: { courseId },
                orderBy: { order: "asc" },
            })
        );

        return NextResponse.json({ images });
    } catch (error) {
        console.error("[Hero Images API] GET Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/admin/hero-images — upload new hero image (multipart/form-data)
export async function POST(req: NextRequest) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const label = (formData.get("label") as string) || "";

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
        const ext = path.extname(file.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return NextResponse.json({ error: "Only image files allowed (jpg, jpeg, png, gif, webp)" }, { status: 400 });
        }

        const MAX_SIZE = 5 * 1024 * 1024; // 5MB for hero images
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
        }

        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `${timestamp}_${sanitizedName}`;
        const storagePath = `uploads/images/hero/${fileName}`;
        const absolutePath = path.resolve(process.cwd(), "public", storagePath);
        const dir = path.dirname(absolutePath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(absolutePath, buffer);

        const heroImage = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Get current max order
            const maxOrderRecord = await tx.heroImage.findFirst({
                where: { courseId },
                orderBy: { order: "desc" },
                select: { order: true },
            });
            const nextOrder = maxOrderRecord ? maxOrderRecord.order + 1 : 0;

            return tx.heroImage.create({
                data: {
                    courseId,
                    url: `/api/file?path=${storagePath}`,
                    storagePath,
                    label: label || null,
                    order: nextOrder,
                    isActive: true,
                },
            });
        });

        return NextResponse.json({ success: true, image: heroImage });
    } catch (error) {
        console.error("[Hero Images API] POST Error:", error);
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }
}
