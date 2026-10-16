export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
    name: z.string().trim().min(1, "বিষয়ের নাম লিখুন।").max(120, "নাম অনেক বড়।").optional(),
    teacherUids: z.array(z.string().min(1)).optional(),
});

/** PATCH /api/teaching-subjects/:id — rename and/or replace the assigned teachers (admin only). */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !isAdmin(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" }, { status: 400 });
    }
    const { name, teacherUids } = parsed.data;

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const subject = await tx.teachingSubject.findFirst({ where: { id, courseId } });
            if (!subject) return "NOT_FOUND" as const;

            if (name && name.toLowerCase() !== subject.name.toLowerCase()) {
                const duplicate = await tx.teachingSubject.findFirst({
                    where: { courseId, id: { not: id }, name: { equals: name, mode: "insensitive" } },
                    select: { id: true },
                });
                if (duplicate) return "DUPLICATE" as const;
            }

            if (name) {
                await tx.teachingSubject.update({ where: { id }, data: { name } });
            }
            if (teacherUids) {
                const valid = await tx.user.findMany({
                    where: { courseId, id: { in: teacherUids }, role: { in: ["teacher", "admin"] }, deletedAt: null },
                    select: { id: true },
                });
                await tx.teachingSubjectAssignment.deleteMany({ where: { subjectId: id, courseId } });
                await tx.teachingSubjectAssignment.createMany({
                    data: valid.map((u) => ({ courseId, subjectId: id, teacherUid: u.id })),
                });
            }
            await logActivity(tx, {
                courseId,
                actorUid: user.id,
                actorRole: "ADMIN",
                actionType: "TEACHING_SUBJECT_UPDATED",
                targetType: "teaching_subject",
                targetId: id,
                description: `${user.displayName} "${name ?? subject.name}" বিষয়টি আপডেট করেছেন`,
            });
            return "OK" as const;
        });

        if (result === "NOT_FOUND") return NextResponse.json({ error: "বিষয় পাওয়া যায়নি।" }, { status: 404 });
        if (result === "DUPLICATE") {
            return NextResponse.json({ error: "এই নামের বিষয় আগে থেকেই আছে।" }, { status: 409 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Failed to update teaching subject:", error);
        return NextResponse.json({ error: "বিষয় আপডেট করা যায়নি।" }, { status: 500 });
    }
}

/**
 * DELETE /api/teaching-subjects/:id (admin only). Logged classes keep the
 * subject name they were saved with, so history stays readable.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !isAdmin(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    const deleted = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const subject = await tx.teachingSubject.findFirst({ where: { id, courseId } });
        if (!subject) return false;
        await tx.teachingSubject.delete({ where: { id } });
        await logActivity(tx, {
            courseId,
            actorUid: user.id,
            actorRole: "ADMIN",
            actionType: "TEACHING_SUBJECT_DELETED",
            targetType: "teaching_subject",
            targetId: id,
            description: `${user.displayName} "${subject.name}" বিষয়টি মুছেছেন`,
        });
        return true;
    });

    if (!deleted) return NextResponse.json({ error: "বিষয় পাওয়া যায়নি।" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
