export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ATTENDANCE_STATUSES } from "@/lib/attendance";
import { HOUR, rateLimit } from "@/lib/rateLimit";

const createSchema = z.object({
    sessionId: z.string().min(1),
    requestedStatus: z.enum(ATTENDANCE_STATUSES),
    reason: z.string().trim().min(5, "কারণ লিখুন (কমপক্ষে ৫ অক্ষর)।").max(500),
});

/**
 * GET /api/student/attendance-corrections — the signed-in student's own
 * correction requests, newest first.
 *
 * Like /api/attendance/me, scoped to the batch and roll on the session and
 * never to an id from the request.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || user.role !== "student") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { studentBatchName, studentRoll } = user;
    if (!studentBatchName || !studentRoll) {
        return NextResponse.json({ requests: [], canApply: false });
    }

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const student = await tx.batchStudent.findUnique({
            where: { courseId_batchName_roll: { courseId, batchName: studentBatchName, roll: studentRoll } },
            select: { id: true, batch: { select: { status: true } } },
        });
        if (!student) return NextResponse.json({ requests: [], canApply: false });

        const requests = await tx.attendanceCorrectionRequest.findMany({
            where: { courseId, studentId: student.id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                sessionId: true,
                date: true,
                currentStatus: true,
                requestedStatus: true,
                reason: true,
                status: true,
                reviewNote: true,
                createdAt: true,
            },
        });
        // A completed batch's attendance is closed: it stays on record, but
        // nobody is taking or correcting roll calls for it any more.
        return NextResponse.json({ requests, canApply: student.batch.status === "active" });
    });
}

/**
 * POST /api/student/attendance-corrections — ask for one day to be changed.
 *
 * Nothing changes on the record until an admin approves it.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || user.role !== "student") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { studentBatchName, studentRoll } = user;
    if (!studentBatchName || !studentRoll) {
        return NextResponse.json({ error: "আপনার ব্যাচের তথ্য পাওয়া যায়নি।" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" },
            { status: 400 }
        );
    }
    const { sessionId, requestedStatus, reason } = parsed.data;

    if (!rateLimit(`attendance-correction:${user.id}`, 30, HOUR).ok) {
        return NextResponse.json(
            { error: "অনেকগুলো আবেদন করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
            { status: 429 }
        );
    }

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const student = await tx.batchStudent.findUnique({
                where: { courseId_batchName_roll: { courseId, batchName: studentBatchName, roll: studentRoll } },
                select: { id: true, roll: true, name: true, batch: { select: { status: true } } },
            });
            if (!student) {
                return NextResponse.json({ error: "আপনার ব্যাচের তথ্য পাওয়া যায়নি।" }, { status: 404 });
            }
            if (student.batch.status !== "active") {
                return NextResponse.json(
                    { error: "ব্যাচ শেষ হয়ে গেছে — এখন আর সংশোধনের আবেদন করা যাবে না।" },
                    { status: 403 }
                );
            }

            // The student's own record for that roll call — which is also what
            // proves the session belongs to their batch.
            const record = await tx.attendanceRecord.findUnique({
                where: { sessionId_studentId: { sessionId, studentId: student.id } },
                select: { status: true, session: { select: { date: true, batchName: true } } },
            });
            if (!record) {
                return NextResponse.json({ error: "এই দিনের হাজিরার রেকর্ড পাওয়া যায়নি।" }, { status: 404 });
            }
            if (record.status === requestedStatus) {
                return NextResponse.json({ error: "রেকর্ডে ইতিমধ্যে এটাই আছে।" }, { status: 400 });
            }

            const pending = await tx.attendanceCorrectionRequest.findFirst({
                where: { courseId, sessionId, studentId: student.id, status: "PENDING" },
                select: { id: true },
            });
            if (pending) {
                return NextResponse.json(
                    { error: "এই দিনের জন্য আপনার একটি আবেদন ইতিমধ্যে অপেক্ষমাণ আছে।" },
                    { status: 409 }
                );
            }

            const request = await tx.attendanceCorrectionRequest.create({
                data: {
                    courseId,
                    sessionId,
                    studentId: student.id,
                    date: record.session.date,
                    batchName: record.session.batchName,
                    roll: student.roll,
                    studentName: student.name,
                    currentStatus: record.status,
                    requestedStatus,
                    reason,
                },
            });
            return NextResponse.json({ request }, { status: 201 });
        });
    } catch (error) {
        // Two submits racing past the check above land on the partial unique index.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return NextResponse.json(
                { error: "এই দিনের জন্য আপনার একটি আবেদন ইতিমধ্যে অপেক্ষমাণ আছে।" },
                { status: 409 }
            );
        }
        console.error("Failed to create attendance correction request:", error);
        return NextResponse.json({ error: "আবেদন জমা দেওয়া যায়নি।" }, { status: 500 });
    }
}
