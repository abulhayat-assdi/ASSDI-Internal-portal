export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;

    const modules = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.courseModule.findMany({
            where: { courseId },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        })
    );

    return NextResponse.json(modules);
}

export async function POST(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const body = await req.json();
    const { slug, title, description, pdfLink, bullets, curriculum, isPublished, order, teacherName, teacherEmail } = body;

    if (!slug || !title) {
        return NextResponse.json({ error: "slug and title are required" }, { status: 400 });
    }

    const created = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const existing = await tx.courseModule.findUnique({ where: { courseId_slug: { courseId, slug } } });
        if (existing) return null;

        return tx.courseModule.create({
            data: {
                courseId,
                slug,
                title,
                description: description ?? "",
                pdfLink: pdfLink ?? "",
                bullets: bullets ?? [],
                curriculum: curriculum ?? [],
                isPublished: isPublished ?? true,
                order: order ?? 0,
                teacherName: teacherName ?? "",
                teacherEmail: teacherEmail ?? "",
            },
        });
    });

    if (!created) {
        return NextResponse.json({ error: "A module with this slug already exists" }, { status: 409 });
    }

    return NextResponse.json(created, { status: 201 });
}
