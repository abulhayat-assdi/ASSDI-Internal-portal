export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { cvFormSchema } from "@/lib/cv/schemas";
import type { Prisma } from "@prisma/client";

async function getDraftAndCheckOwner(tx: Prisma.TransactionClient, courseId: string, draftId: string, userId: string, userRole: string) {
    const draft = await tx.cvDraft.findUnique({
        where: { id: draftId, courseId },
        include: { template: { select: { id: true, name: true, slug: true, config: true } } },
    });
    if (!draft) return { draft: null, forbidden: false };
    if (draft.userId !== userId && !isAdmin({ id: userId, email: '', displayName: '', role: userRole })) {
        return { draft: null, forbidden: true };
    }
    return { draft, forbidden: false };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const { draft, forbidden } = await getDraftAndCheckOwner(tx, courseId, id, user.id, user.role);
        if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json(draft);
    });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;
    const body = await req.json();
    const parsed = cvFormSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const { draft, forbidden } = await getDraftAndCheckOwner(tx, courseId, id, user.id, user.role);
        if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const updated = await tx.cvDraft.update({
            where: { id, courseId },
            data: {
                title: parsed.data.title,
                fullName: parsed.data.fullName,
                profilePhoto: parsed.data.profilePhoto,
                careerObjective: parsed.data.careerObjective,
                phone: parsed.data.phone,
                email: parsed.data.email,
                address: parsed.data.address,
                dateOfBirth: parsed.data.dateOfBirth,
                bloodGroup: parsed.data.bloodGroup,
                religion: parsed.data.religion,
                maritalStatus: parsed.data.maritalStatus,
                nationality: parsed.data.nationality,
                skills: parsed.data.skills,
                languages: parsed.data.languages,
                hobbies: parsed.data.hobbies,
                workExperience: parsed.data.workExperience,
                training: parsed.data.training,
                education: parsed.data.education,
                references: parsed.data.references,
                declaration: parsed.data.declaration,
                signature: parsed.data.signature,
                sectionOrder: parsed.data.sectionOrder,
                linkedin: parsed.data.linkedin,
                visibleSections: parsed.data.visibleSections,
            },
            include: { template: { select: { id: true, name: true, slug: true, config: true } } },
        });

        return NextResponse.json(updated);
    });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const { draft, forbidden } = await getDraftAndCheckOwner(tx, courseId, id, user.id, user.role);
        if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await tx.cvDraft.delete({ where: { id, courseId } });
        return NextResponse.json({ success: true });
    });
}
