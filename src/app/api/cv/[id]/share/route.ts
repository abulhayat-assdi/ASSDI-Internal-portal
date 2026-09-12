export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const draft = await tx.cvDraft.findUnique({ where: { id, courseId }, select: { userId: true, shareSlug: true } });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (draft.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const slug = draft.shareSlug ?? randomBytes(12).toString("base64url");

        const updated = await tx.cvDraft.update({
            where: { id, courseId },
            data: { shareSlug: slug, isPublic: true },
        });

        return NextResponse.json({ shareSlug: updated.shareSlug, isPublic: true });
    });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const draft = await tx.cvDraft.findUnique({ where: { id, courseId }, select: { userId: true } });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (draft.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await tx.cvDraft.update({
            where: { id, courseId },
            data: { shareSlug: null, isPublic: false },
        });

        return NextResponse.json({ isPublic: false });
    });
}
