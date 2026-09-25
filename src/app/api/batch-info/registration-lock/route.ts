export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

const bodySchema = z.object({
    batchName: z.string().min(1),
    roll: z.string().min(1),
    /** true reopens the roll for one more registration; false locks it again. */
    unlocked: z.boolean(),
});

/**
 * GET /api/batch-info/registration-lock?batchName=
 *
 * Which rolls in a batch are already claimed, and which have been reopened.
 * The roster screen needs both to show the right control per student.
 */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !caller.courseId || !isAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;
    const batchName = new URL(req.url).searchParams.get("batchName");

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const [roster, users] = await Promise.all([
            tx.batchStudent.findMany({
                where: { courseId, ...(batchName ? { batchName } : {}) },
                select: { batchName: true, roll: true, registrationUnlocked: true, accessBlockedAt: true },
            }),
            tx.user.findMany({
                where: {
                    courseId,
                    role: "student",
                    deletedAt: null,
                    ...(batchName ? { studentBatchName: batchName } : {}),
                },
                select: { studentBatchName: true, studentRoll: true, email: true },
            }),
        ]);

        const claimed = new Map(
            users.map((u) => [`${u.studentBatchName}::${u.studentRoll}`, u.email])
        );

        return NextResponse.json({
            rolls: roster.map((r) => ({
                batchName: r.batchName,
                roll: r.roll,
                registeredEmail: claimed.get(`${r.batchName}::${r.roll}`) ?? null,
                unlocked: r.registrationUnlocked,
                accessBlockedAt: r.accessBlockedAt,
            })),
        });
    });
}

/**
 * PATCH /api/batch-info/registration-lock — let one roll be registered again.
 *
 * Admin only, and deliberately one roll at a time: this is the escape hatch
 * for "the student lost access to their email", not a bulk switch.
 */
export async function PATCH(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !caller.courseId || !isAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: "ইনপুট সঠিক নয়।" }, { status: 400 });
    }
    const { batchName, roll, unlocked } = parsed.data;

    const updated = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const student = await tx.batchStudent.findUnique({
            where: { courseId_batchName_roll: { courseId, batchName, roll } },
            select: { id: true },
        });
        if (!student) return null;
        return tx.batchStudent.update({
            where: { id: student.id },
            data: { registrationUnlocked: unlocked },
            select: { batchName: true, roll: true, registrationUnlocked: true },
        });
    });

    if (!updated) return NextResponse.json({ error: "ছাত্র পাওয়া যায়নি।" }, { status: 404 });
    return NextResponse.json({ student: updated });
}
