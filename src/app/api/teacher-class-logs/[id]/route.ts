export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { classLogAccess } from "@/lib/teacherClassLogAuth";
import { canTeacherEditLog, checkClassTiming, classLogSchema, formatClock } from "@/lib/teacherClassLog";
import { findOverlappingClass } from "@/lib/teacherClassLogDb";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/teacher-class-logs/:id — correct a class.
 * A teacher may change only their own entry, and only on the day they made
 * it; an admin may change any. The class stays with its teacher.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    const access = user ? classLogAccess(user) : null;
    if (!user || !user.courseId || !access) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const admin = access === "all";
    const courseId = user.courseId;
    const { id } = await params;

    const parsed = classLogSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" }, { status: 400 });
    }
    const { batchName, date, subjectId, topic, startTime, endTime } = parsed.data;

    const timing = checkClassTiming(date, startTime, endTime);
    if ("error" in timing) return NextResponse.json({ error: timing.error }, { status: 400 });

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const existing = await tx.teacherClassLog.findFirst({ where: { id, courseId } });
            // Someone else's entry looks the same as a missing one to a teacher.
            if (!existing || (!admin && existing.teacherUid !== user.id)) {
                return { error: "এন্ট্রি পাওয়া যায়নি।", status: 404 };
            }
            if (!admin && !canTeacherEditLog(existing.createdAt)) {
                return { error: "শুধু যেদিন এন্ট্রি করা হয়েছে সেদিনই এডিট করা যায়। অ্যাডমিনের সাথে যোগাযোগ করুন।", status: 403 };
            }

            const subject = await tx.teachingSubject.findFirst({
                where: { id: subjectId, courseId, assignments: { some: { teacherUid: existing.teacherUid } } },
                select: { id: true, name: true },
            });
            if (!subject) return { error: "এই বিষয়টি এই শিক্ষকের জন্য অ্যাসাইন করা নেই।", status: 403 };

            const batch = await tx.batch.findFirst({ where: { courseId, name: batchName, status: "active" } });
            if (!batch) return { error: "ব্যাচ পাওয়া যায়নি।", status: 404 };

            const clash = await findOverlappingClass(tx, {
                courseId,
                teacherUid: existing.teacherUid,
                date,
                startTime,
                endTime,
                excludeId: id,
            });
            if (clash) {
                return {
                    error: `এই সময়ে ${clash.batchName} ব্যাচে (${formatClock(clash.startTime)} - ${formatClock(clash.endTime)}) আগে থেকেই একটি ক্লাস সেভ করা আছে।`,
                    status: 409,
                };
            }

            const log = await tx.teacherClassLog.update({
                where: { id },
                data: {
                    batchId: batch.id,
                    batchName: batch.name,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    date,
                    topic,
                    startTime,
                    endTime,
                    durationMin: timing.durationMin,
                },
            });
            await logActivity(tx, {
                courseId,
                actorUid: user.id,
                actorRole: admin ? "ADMIN" : "TEACHER",
                actionType: "TEACHER_CLASS_UPDATED",
                targetType: "teacher_class_log",
                targetId: id,
                description: `${user.displayName} ${existing.teacherName}-এর ${date} তারিখের ক্লাস এডিট করেছেন`,
            });
            return { log };
        });

        if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ log: result.log });
    } catch (error) {
        console.error("Failed to update teacher class log:", error);
        return NextResponse.json({ error: "ক্লাস আপডেট করা যায়নি।" }, { status: 500 });
    }
}

/** DELETE /api/teacher-class-logs/:id — admin / super admin only. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || classLogAccess(user) !== "all") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    const deleted = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const existing = await tx.teacherClassLog.findFirst({ where: { id, courseId } });
        if (!existing) return false;
        await tx.teacherClassLog.delete({ where: { id } });
        await logActivity(tx, {
            courseId,
            actorUid: user.id,
            actorRole: "ADMIN",
            actionType: "TEACHER_CLASS_DELETED",
            targetType: "teacher_class_log",
            targetId: id,
            description: `${user.displayName} ${existing.teacherName}-এর ${existing.batchName} ব্যাচের ${existing.date} তারিখের ক্লাস মুছেছেন`,
        });
        return true;
    });

    if (!deleted) return NextResponse.json({ error: "এন্ট্রি পাওয়া যায়নি।" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
