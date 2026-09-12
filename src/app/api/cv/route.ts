export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma, withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
    templateId: z.string().min(1),
    title: z.string().min(1).default("My CV"),
});

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const drafts = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.cvDraft.findMany({
            where: { courseId, userId: user.id },
            include: { template: { select: { id: true, name: true, slug: true, config: true } } },
            orderBy: { updatedAt: "desc" },
        })
    );

    return NextResponse.json(drafts);
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { templateId, title } = parsed.data;

    // CvTemplate is a shared, platform-level library — not course-scoped.
    const template = await prisma.cvTemplate.findFirst({
        where: { id: templateId, isActive: true },
    });
    if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const draft = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.cvDraft.create({
            data: {
                courseId,
                userId: user.id,
                templateId,
                title,
            },
            include: { template: { select: { id: true, name: true, slug: true, config: true } } },
        })
    );

    return NextResponse.json(draft, { status: 201 });
}
