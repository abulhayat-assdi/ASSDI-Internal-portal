export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

const createSchema = z.object({
    name: z.string().trim().min(1, "বিষয়ের নাম লিখুন।").max(120, "নাম অনেক বড়।"),
    teacherUids: z.array(z.string().min(1)).default([]),
});

/**
 * GET /api/teaching-subjects
 *  - Admin / Super Admin: every subject with the teachers assigned to it,
 *    plus the course's teacher list for the assignment picker.
 *  - Teacher: only the subjects assigned to them — nothing about anyone else.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const admin = isAdmin(user);
    if (!admin && !hasRequiredPermission(user, "teacher_attendance")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        if (!admin) {
            const subjects = await tx.teachingSubject.findMany({
                where: { courseId, assignments: { some: { teacherUid: user.id } } },
                select: { id: true, name: true },
                orderBy: { name: "asc" },
            });
            return NextResponse.json({ subjects });
        }

        const [subjects, teachers] = await Promise.all([
            tx.teachingSubject.findMany({
                where: { courseId },
                include: { assignments: { select: { teacherUid: true } } },
                orderBy: { name: "asc" },
            }),
            tx.user.findMany({
                where: { courseId, role: { in: ["teacher", "admin"] }, deletedAt: null },
                select: { id: true, displayName: true, role: true },
                orderBy: { displayName: "asc" },
            }),
        ]);
        return NextResponse.json({
            subjects: subjects.map((s) => ({
                id: s.id,
                name: s.name,
                teacherUids: s.assignments.map((a) => a.teacherUid),
            })),
            teachers,
        });
    });
}

/** POST /api/teaching-subjects — add a subject and say which teachers take it (admin only). */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !isAdmin(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" }, { status: 400 });
    }
    const { name, teacherUids } = parsed.data;

    try {
        const subject = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const duplicate = await tx.teachingSubject.findFirst({
                where: { courseId, name: { equals: name, mode: "insensitive" } },
                select: { id: true },
            });
            if (duplicate) return "DUPLICATE" as const;

            // Only teachers of this course can be assigned.
            const valid = await tx.user.findMany({
                where: { courseId, id: { in: teacherUids }, role: { in: ["teacher", "admin"] }, deletedAt: null },
                select: { id: true },
            });
            const created = await tx.teachingSubject.create({
                data: {
                    courseId,
                    name,
                    assignments: { create: valid.map((u) => ({ courseId, teacherUid: u.id })) },
                },
            });
            await logActivity(tx, {
                courseId,
                actorUid: user.id,
                actorRole: "ADMIN",
                actionType: "TEACHING_SUBJECT_CREATED",
                targetType: "teaching_subject",
                targetId: created.id,
                description: `${user.displayName} "${name}" বিষয়টি যোগ করেছেন`,
            });
            return { id: created.id, name: created.name, teacherUids: valid.map((u) => u.id) };
        });

        if (subject === "DUPLICATE") {
            return NextResponse.json({ error: "এই নামের বিষয় আগে থেকেই আছে।" }, { status: 409 });
        }
        return NextResponse.json({ subject }, { status: 201 });
    } catch (error) {
        console.error("Failed to create teaching subject:", error);
        return NextResponse.json({ error: "বিষয় সেভ করা যায়নি।" }, { status: 500 });
    }
}
