export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { modulesData } from "@/data/modules";

// Updates the curriculum (and title/description) of an existing module from the data file.
// Tries slug first, then falls back to seedKey so renamed modules still work.
export async function POST(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const { slug } = await req.json();
    if (!slug) {
        return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const existing = await tx.courseModule.findUnique({ where: { courseId_slug: { courseId, slug } } });
        if (!existing) return { status: 404 as const, error: `Module with slug '${slug}' not found in database` };

        let dataKey = slug;
        let data = modulesData[slug];
        if (!data && existing.seedKey && modulesData[existing.seedKey]) {
            dataKey = existing.seedKey;
            data = modulesData[existing.seedKey];
        }

        if (!data) return { status: 404 as const, error: `No data file found for slug: ${slug}` };

        await tx.courseModule.update({
            where: { id: existing.id, courseId },
            data: { title: data.title, description: data.description, curriculum: data.modules as unknown as Prisma.InputJsonValue },
        });

        return { status: 200 as const, dataKey };
    });

    if (result.status === 404) {
        return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({
        success: true,
        message: `'${slug}' curriculum updated from data file (key: ${result.dataKey}).`,
    });
}
