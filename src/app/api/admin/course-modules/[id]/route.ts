export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    const module_ = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.courseModule.findUnique({ where: { id, courseId } })
    );

    if (!module_) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(module_);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;
    const { id } = await params;
    const body = await req.json();
    const { slug, title, description, pdfLink, bullets, curriculum, isPublished, order, teacherName, teacherEmail } = body;

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const existing = await tx.courseModule.findUnique({ where: { id, courseId } });
        if (!existing) return { status: 404 as const };

        if (slug && slug !== existing.slug) {
            const conflict = await tx.courseModule.findUnique({ where: { courseId_slug: { courseId, slug } } });
            if (conflict) return { status: 409 as const };
        }

        const updated = await tx.courseModule.update({
            where: { id, courseId },
            data: {
                slug: slug ?? undefined,
                title: title ?? undefined,
                description: description ?? undefined,
                pdfLink: pdfLink ?? undefined,
                bullets: bullets ?? undefined,
                curriculum: curriculum ?? undefined,
                isPublished: isPublished ?? undefined,
                order: order ?? undefined,
                teacherName: teacherName ?? undefined,
                teacherEmail: teacherEmail ?? undefined,
            },
        });
        return { status: 200 as const, updated };
    });

    if (result.status === 404) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result.status === 409) return NextResponse.json({ error: "A module with this slug already exists" }, { status: 409 });
    return NextResponse.json(result.updated);
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;
    const { id } = await params;

    const deleted = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const existing = await tx.courseModule.findUnique({ where: { id, courseId } });
        if (!existing) return false;
        await tx.courseModule.delete({ where: { id, courseId } });
        return true;
    });

    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
}
