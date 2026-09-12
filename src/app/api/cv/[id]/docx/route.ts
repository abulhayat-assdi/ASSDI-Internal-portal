export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { generateDocxBuffer } from "@/lib/cv/docx/generateDocx";
import type { CvDraftFull } from "@/lib/cv/schemas";
import type { TemplateConfig } from "@/lib/cv/constants";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const draft = await tx.cvDraft.findUnique({
            where: { id, courseId },
            include: { template: { select: { id: true, name: true, slug: true, config: true } } },
        });

        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (draft.userId !== user.id && !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const defaultConfig: TemplateConfig = {
            primaryColor: "#1e3a5f",
            sidebarColor: "#1e3a5f",
            sidebarWidth: 38,
            fontFamily: "Helvetica",
            photoShape: "circle",
            showPhoto: true,
        };

        const fullData: CvDraftFull = {
            id: draft.id,
            userId: draft.userId,
            templateId: draft.templateId,
            title: draft.title,
            fullName: draft.fullName ?? "",
            profilePhoto: draft.profilePhoto ?? "",
            careerObjective: draft.careerObjective ?? "",
            phone: draft.phone ?? "",
            email: draft.email ?? "",
            address: draft.address ?? "",
            dateOfBirth: draft.dateOfBirth ?? "",
            bloodGroup: draft.bloodGroup ?? "",
            religion: draft.religion ?? "",
            maritalStatus: draft.maritalStatus ?? "",
            nationality: draft.nationality ?? "",
            skills: (draft.skills as string[]) ?? [],
            languages: (draft.languages as CvDraftFull["languages"]) ?? [],
            hobbies: (draft.hobbies as string[]) ?? [],
            workExperience: (draft.workExperience as CvDraftFull["workExperience"]) ?? [],
            training: (draft.training as CvDraftFull["training"]) ?? [],
            education: (draft.education as CvDraftFull["education"]) ?? [],
            references: (draft.references as CvDraftFull["references"]) ?? [],
            declaration: draft.declaration ?? "",
            signature: draft.signature ?? "",
            sectionOrder: (draft.sectionOrder as string[]) ?? [
                "workExperience", "training", "education", "references",
            ],
            linkedin: draft.linkedin ?? "",
            visibleSections: (draft.visibleSections as string[]) ?? [
                'careerObjective', 'workExperience', 'training', 'education', 'references', 'skills', 'languages', 'hobbies', 'personalInfo', 'declaration'
            ],
            shareSlug: draft.shareSlug,
            isPublic: draft.isPublic,
            downloadCount: draft.downloadCount,
            createdAt: draft.createdAt.toISOString(),
            updatedAt: draft.updatedAt.toISOString(),
            template: draft.template
                ? {
                      id: draft.template.id,
                      name: draft.template.name,
                      slug: draft.template.slug,
                      config: (draft.template.config as TemplateConfig) ?? defaultConfig,
                  }
                : undefined,
        };

        try {
            const buffer = await generateDocxBuffer(fullData);

            const safeName = (fullData.fullName || "CV").replace(/[^a-zA-Z0-9 _-]/g, "_");
            const filename = `${safeName}_CV.docx`;

            await tx.cvDraft
                .update({ where: { id, courseId }, data: { downloadCount: { increment: 1 } } })
                .catch(() => {});

            return new NextResponse(new Uint8Array(buffer), {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Content-Length": String(buffer.length),
                },
            });
        } catch (err) {
            console.error("[DOCX Route Error]", err);
            return NextResponse.json({ error: "Failed to generate Word document" }, { status: 500 });
        }
    });
}
