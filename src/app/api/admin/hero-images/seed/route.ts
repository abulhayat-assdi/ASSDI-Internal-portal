export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { withCourseContext } from "@/lib/db";

const DEFAULT_IMAGES = [
    { url: "/images/home/hero-slide-1.jpg", storagePath: "images/home/hero-slide-1.jpg", label: "Hero Slide 1", order: 0 },
    { url: "/images/home/hero-slide-2.jpg", storagePath: "images/home/hero-slide-2.jpg", label: "Hero Slide 2", order: 1 },
    { url: "/images/home/audience-bg.JPG",  storagePath: "images/home/audience-bg.JPG",  label: "Audience Background", order: 2 },
];

// POST /api/admin/hero-images/seed — seeds default hero images for this course if none exist yet.
export async function POST(req: NextRequest) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const existing = await tx.heroImage.count({ where: { courseId } });
            if (existing > 0) {
                return { message: `Table already has ${existing} image(s). No seed needed.`, count: existing };
            }

            await tx.heroImage.createMany({
                data: DEFAULT_IMAGES.map(img => ({
                    courseId,
                    url: img.url,
                    storagePath: img.storagePath,
                    label: img.label,
                    order: img.order,
                    isActive: true,
                })),
                skipDuplicates: true,
            });

            const count = await tx.heroImage.count({ where: { courseId } });
            return { message: `Seeded ${count} default hero images.`, count };
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[Hero Images Seed] Error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
