export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { classLogAccess } from "@/lib/teacherClassLogAuth";
import { logActivity } from "@/lib/activityLog";
import {
    canTeacherEditLog,
    checkClassTiming,
    classLogFields,
    formatClock,
    isValidDateString,
} from "@/lib/teacherClassLog";
import { findOverlappingClass } from "@/lib/teacherClassLogDb";

const createSchema = z.object({
    ...classLogFields,
    // Admin / Super Admin only: whose class this is ("Fill up Others").
    // Anyone else's value is ignored — the class is always theirs.
    teacherUid: z.string().min(1).optional(),
});

/**
 * GET /api/teacher-class-logs?from=&to=&batchName=&subjectId=&teacherUid=
 *
 * A teacher always gets their own classes, whatever teacherUid they send:
 * the filter is applied here, not trusted from the client. Admins see every
 * teacher's and may narrow by teacherUid.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = classLogAccess(user);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const admin = access === "all";
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const batchName = searchParams.get("batchName");
    const subjectId = searchParams.get("subjectId");
    const requestedTeacher = searchParams.get("teacherUid");
    if ((from && !isValidDateString(from)) || (to && !isValidDateString(to))) {
        return NextResponse.json({ error: "তারিখ সঠিক নয়।" }, { status: 400 });
    }

    const teacherUid = admin ? requestedTeacher : user.id;

    const logs = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.teacherClassLog.findMany({
            where: {
                courseId,
                ...(teacherUid ? { teacherUid } : {}),
                ...(batchName ? { batchName } : {}),
                ...(subjectId ? { subjectId } : {}),
                ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
            },
            orderBy: [{ date: "desc" }, { startTime: "desc" }],
            take: 500,
        })
    );

    return NextResponse.json({
        logs: logs.map((l) => ({
            ...l,
            // Drives the Edit button; the PATCH route re-checks it.
            canEdit: admin || canTeacherEditLog(l.createdAt),
            canDelete: admin,
        })),
    });
}

/** POST /api/teacher-class-logs — save one class a teacher took. */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = classLogAccess(user);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const admin = access === "all";
    const courseId = user.courseId;

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" }, { status: 400 });
    }
    const { batchName, date, subjectId, topic, startTime, endTime } = parsed.data;
    const targetUid = admin && parsed.data.teacherUid ? parsed.data.teacherUid : user.id;
    const onBehalf = targetUid !== user.id;

    const timing = checkClassTiming(date, startTime, endTime);
    if ("error" in timing) return NextResponse.json({ error: timing.error }, { status: 400 });

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const teacher = onBehalf
                ? await tx.user.findFirst({
                      where: { id: targetUid, courseId, role: { in: ["teacher", "admin"] }, deletedAt: null },
                      select: { id: true, displayName: true },
                  })
                : { id: user.id, displayName: user.displayName };
            if (!teacher) return { error: "শিক্ষক পাওয়া যায়নি।", status: 404 };

            // Only a subject an admin assigned to this teacher.
            const subject = await tx.teachingSubject.findFirst({
                where: { id: subjectId, courseId, assignments: { some: { teacherUid: teacher.id } } },
                select: { id: true, name: true },
            });
            if (!subject) return { error: "এই বিষয়টি এই শিক্ষকের জন্য অ্যাসাইন করা নেই।", status: 403 };

            // Classes are only taken in running batches.
            const batch = await tx.batch.findFirst({ where: { courseId, name: batchName, status: "active" } });
            if (!batch) return { error: "ব্যাচ পাওয়া যায়নি।", status: 404 };

            const clash = await findOverlappingClass(tx, {
                courseId,
                teacherUid: teacher.id,
                date,
                startTime,
                endTime,
            });
            if (clash) {
                return {
                    error: `এই সময়ে ${clash.batchName} ব্যাচে (${formatClock(clash.startTime)} - ${formatClock(clash.endTime)}) আগে থেকেই একটি ক্লাস সেভ করা আছে।`,
                    status: 409,
                };
            }

            const log = await tx.teacherClassLog.create({
                data: {
                    courseId,
                    teacherUid: teacher.id,
                    teacherName: teacher.displayName,
                    batchId: batch.id,
                    batchName: batch.name,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    date,
                    topic,
                    startTime,
                    endTime,
                    durationMin: timing.durationMin,
                    enteredByUid: user.id,
                    enteredByName: user.displayName,
                    enteredByAdmin: onBehalf,
                },
            });
            await logActivity(tx, {
                courseId,
                actorUid: user.id,
                actorRole: admin ? "ADMIN" : "TEACHER",
                actionType: "TEACHER_CLASS_LOGGED",
                targetType: "teacher_class_log",
                targetId: log.id,
                description: onBehalf
                    ? `${user.displayName} ${teacher.displayName}-এর ${batch.name} ব্যাচের ${date} তারিখের ক্লাস যোগ করেছেন`
                    : `${teacher.displayName} ${batch.name} ব্যাচের ${date} তারিখের ক্লাস সেভ করেছেন`,
            });
            return { log };
        });

        if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ log: result.log }, { status: 201 });
    } catch (error) {
        console.error("Failed to save teacher class log:", error);
        return NextResponse.json({ error: "ক্লাস সেভ করা যায়নি।" }, { status: 500 });
    }
}
