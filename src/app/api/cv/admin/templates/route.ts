export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma, withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin, isSuperAdmin } from "@/lib/auth";
import { z } from "zod";

const templateSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens"),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    isActive: z.boolean().optional().default(true),
    config: z.object({
        primaryColor: z.string(),
        sidebarColor: z.string(),
        sidebarWidth: z.number().min(20).max(50),
        fontFamily: z.string(),
        photoShape: z.enum(["circle", "square"]),
        showPhoto: z.boolean(),
    }),
});

const updateSchema = templateSchema.partial().extend({ id: z.string().min(1) });

// CvTemplate is a shared, platform-level design library (not course-scoped),
// so it uses the plain `prisma` client throughout — no RLS applies to it.
// Only super_admin may create/edit/delete templates, since they're shared
// across every course; any course admin may still read them.

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    // Public GET for active templates (students need this); admin gets all
    if (user && isAdmin(user)) {
        const templates = await prisma.cvTemplate.findMany({ orderBy: { createdAt: "asc" } });
        return NextResponse.json(templates);
    }
    const templates = await prisma.cvTemplate.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const existing = await prisma.cvTemplate.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

    const template = await prisma.cvTemplate.create({ data: parsed.data });
    return NextResponse.json(template, { status: 201 });
}

export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const { id, ...data } = parsed.data;

    const template = await prisma.cvTemplate.update({ where: { id }, data });
    return NextResponse.json(template);
}

export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Check if any drafts (in ANY course) use this template — a shared
    // template's usage isn't scoped to one course, so this bypasses RLS.
    const activeDraftCount = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.cvDraft.count({ where: { templateId: id } })
    );
    if (activeDraftCount > 0) {
        // Soft-disable instead of delete
        await prisma.cvTemplate.update({ where: { id }, data: { isActive: false } });
        return NextResponse.json({ softDisabled: true, message: "Template has active drafts and was disabled instead of deleted." });
    }

    await prisma.cvTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
