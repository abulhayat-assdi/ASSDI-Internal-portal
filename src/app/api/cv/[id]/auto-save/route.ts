export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { cvAutoSaveSchema } from "@/lib/cv/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;
    const body = await req.json();
    const parsed = cvAutoSaveSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    const data = parsed.data;

    // Build update object with only defined fields
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.profilePhoto !== undefined) updateData.profilePhoto = data.profilePhoto;
    if (data.careerObjective !== undefined) updateData.careerObjective = data.careerObjective;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup;
    if (data.religion !== undefined) updateData.religion = data.religion;
    if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus;
    if (data.nationality !== undefined) updateData.nationality = data.nationality;
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.languages !== undefined) updateData.languages = data.languages;
    if (data.hobbies !== undefined) updateData.hobbies = data.hobbies;
    if (data.workExperience !== undefined) updateData.workExperience = data.workExperience;
    if (data.training !== undefined) updateData.training = data.training;
    if (data.education !== undefined) updateData.education = data.education;
    if (data.references !== undefined) updateData.references = data.references;
    if (data.declaration !== undefined) updateData.declaration = data.declaration;
    if (data.signature !== undefined) updateData.signature = data.signature;
    if (data.sectionOrder !== undefined) updateData.sectionOrder = data.sectionOrder;
    if (data.linkedin !== undefined) updateData.linkedin = data.linkedin;
    if (data.visibleSections !== undefined) updateData.visibleSections = data.visibleSections;

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ success: true });
    }

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const draft = await tx.cvDraft.findUnique({ where: { id, courseId }, select: { userId: true } });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (draft.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await tx.cvDraft.update({ where: { id, courseId }, data: updateData });
        return NextResponse.json({ success: true });
    });
}
