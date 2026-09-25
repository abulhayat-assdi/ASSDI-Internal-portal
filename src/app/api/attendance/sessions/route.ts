export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import { ATTENDANCE_STATUSES, isValidDate } from "@/lib/attendance";

/** Taking a roll call is a teaching task; the report side is a separate permission. */
function canTakeAttendance(user: Parameters<typeof isAdmin>[0]) {
    return (
        isAdmin(user) ||
        hasRequiredPermission(user, "attendance") ||
        hasRequiredPermission(user, "admin_attendance")
    );
}

const saveSchema = z.object({
    batchName: z.string().min(1),
    date: z.string().refine(isValidDate, "date must be YYYY-MM-DD"),
    subject: z.string().max(120).default(""),
    note: z.string().max(500).default(""),
    records: z
        .array(
            z.object({
                studentId: z.string().min(1),
                status: z.enum(ATTENDANCE_STATUSES),
                note: z.string().max(200).default(""),
            })
        )
        .min(1, "at least one student is required"),
});

/**
 * GET /api/attendance/sessions?batchName=&date=&from=&to=
 *
 * With `date` it returns that one roll call including its records (this is
 * what the roll-call screen loads to re-open a day). Without it, a list of
 * sessions in the range, with counts only.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !canTakeAttendance(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get("batchName");
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        if (date) {
            if (!batchName) {
                return NextResponse.json({ error: "batchName is required with date" }, { status: 400 });
            }
            const session = await tx.attendanceSession.findFirst({
                where: { courseId, batchName, date },
                include: { records: { orderBy: { roll: "asc" } } },
            });
            return NextResponse.json({ session });
        }

        const sessions = await tx.attendanceSession.findMany({
            where: {
                courseId,
                ...(batchName ? { batchName } : {}),
                ...(from || to
                    ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
                    : {}),
            },
            orderBy: [{ date: "desc" }, { batchName: "asc" }],
            take: 400,
            include: { _count: { select: { records: true } } },
        });
        return NextResponse.json({ sessions });
    });
}

/**
 * POST /api/attendance/sessions — save (or correct) one roll call.
 *
 * One roll call per batch per day, taken by whichever teacher is free to do
 * it. Saving the same day again replaces its records rather than adding a
 * second set, so reopening a day to fix a mistake cannot inflate the count.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !canTakeAttendance(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const parsed = saveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" },
            { status: 400 }
        );
    }
    const { batchName, date, subject, note, records } = parsed.data;

    try {
        const session = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const batch = await tx.batch.findFirst({ where: { courseId, name: batchName } });
            if (!batch) return null;

            // Only students who really are in this batch — a stale tab or a
            // hand-made request must not write records for someone else's batch.
            const students = await tx.batchStudent.findMany({
                where: { courseId, batchId: batch.id, id: { in: records.map((r) => r.studentId) } },
                select: { id: true, roll: true, name: true },
            });
            const byId = new Map(students.map((s) => [s.id, s]));

            // Keyed by the day alone: whoever takes the roll call second is
            // correcting the first, not opening a parallel one.
            const existing = await tx.attendanceSession.findFirst({
                where: { courseId, batchId: batch.id, date },
                select: { id: true },
            });

            const saved = existing
                ? await tx.attendanceSession.update({
                      where: { id: existing.id },
                      data: { subject, note, takenByUid: user.id, takenByName: user.displayName ?? "" },
                  })
                : await tx.attendanceSession.create({
                      data: {
                          courseId,
                          batchId: batch.id,
                          batchName: batch.name,
                          date,
                          subject,
                          note,
                          takenByUid: user.id,
                          takenByName: user.displayName ?? "",
                      },
                  });

            await tx.attendanceRecord.deleteMany({ where: { sessionId: saved.id } });
            await tx.attendanceRecord.createMany({
                data: records
                    .filter((r) => byId.has(r.studentId))
                    .map((r) => ({
                        courseId,
                        sessionId: saved.id,
                        studentId: r.studentId,
                        roll: byId.get(r.studentId)!.roll,
                        studentName: byId.get(r.studentId)!.name,
                        status: r.status,
                        note: r.note,
                    })),
            });

            return tx.attendanceSession.findUnique({
                where: { id: saved.id },
                include: { records: { orderBy: { roll: "asc" } } },
            });
        });

        if (!session) {
            return NextResponse.json({ error: "ব্যাচ পাওয়া যায়নি।" }, { status: 404 });
        }
        return NextResponse.json({ session });
    } catch (error) {
        console.error("Failed to save attendance:", error);
        return NextResponse.json({ error: "অ্যাটেনডেন্স সেভ করা যায়নি।" }, { status: 500 });
    }
}
