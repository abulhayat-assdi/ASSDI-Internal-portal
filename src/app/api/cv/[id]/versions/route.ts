export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { MAX_CV_VERSIONS } from "@/lib/cv/constants";
import type { Prisma } from "@prisma/client";

async function checkDraftOwner(tx: Prisma.TransactionClient, courseId: string, draftId: string, userId: string) {
    const draft = await tx.cvDraft.findUnique({ where: { id: draftId, courseId } });
    if (!draft) return { draft: null, forbidden: false };
    if (draft.userId !== userId) return { draft: null, forbidden: true };
    return { draft, forbidden: false };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const { draft, forbidden } = await checkDraftOwner(tx, courseId, id, user.id);
        if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const versions = await tx.cvVersion.findMany({
            where: { courseId, draftId: id },
            orderBy: { createdAt: "desc" },
            select: { id: true, label: true, createdAt: true },
        });

        return NextResponse.json(versions);
    });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const label: string | undefined = body.label;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const { draft, forbidden } = await checkDraftOwner(tx, courseId, id, user.id);
        if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Auto-prune oldest if at limit
        const count = await tx.cvVersion.count({ where: { courseId, draftId: id } });
        if (count >= MAX_CV_VERSIONS) {
            const oldest = await tx.cvVersion.findFirst({
                where: { courseId, draftId: id },
                orderBy: { createdAt: "asc" },
            });
            if (oldest) await tx.cvVersion.delete({ where: { id: oldest.id } });
        }

        // Snapshot: all draft fields except id, userId
        const { id: _id, userId: _uid, ...snapshot } = draft as Record<string, unknown>;
        void _id; void _uid;

        const version = await tx.cvVersion.create({
            data: {
                courseId,
                draftId: id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                snapshot: snapshot as any,
                label: label || null,
            },
        });

        return NextResponse.json(version, { status: 201 });
    });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;
    const body = await req.json();
    const versionId: string = body.versionId;
    if (!versionId) return NextResponse.json({ error: "versionId required" }, { status: 400 });

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const { draft, forbidden } = await checkDraftOwner(tx, courseId, id, user.id);
        if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const version = await tx.cvVersion.findUnique({ where: { id: versionId, courseId } });
        if (!version || version.draftId !== id) {
            return NextResponse.json({ error: "Version not found" }, { status: 404 });
        }

        const snapshot = version.snapshot as Record<string, unknown>;

        // Restore all fields except protected ones
        const { id: _id, userId: _uid, shareSlug: _slug, downloadCount: _dl, ...restoreData } = snapshot;
        void _id; void _uid; void _slug; void _dl;

        const updated = await tx.cvDraft.update({
            where: { id, courseId },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: restoreData as any,
            include: { template: { select: { id: true, name: true, slug: true, config: true } } },
        });

        return NextResponse.json(updated);
    });
}
