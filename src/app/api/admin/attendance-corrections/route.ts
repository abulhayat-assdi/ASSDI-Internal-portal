export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import { ATTENDANCE_LABELS } from "@/lib/attendance";
import { logActivity } from "@/lib/activityLog";
import { notifyStudentOfAttendanceCorrection } from "@/lib/notifications";

/** Deciding a correction changes the record the report is built from, so it sits with the report permission. */
function canReview(user: Parameters<typeof isAdmin>[0]) {
    return isAdmin(user) || hasRequiredPermission(user, "admin_attendance");
}

const decideSchema = z.object({
    id: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    reviewNote: z.string().trim().max(300).default(""),
});

/**
 * GET /api/admin/attendance-corrections?status=PENDING|APPROVED|REJECTED|ALL
 *
 * Students' attendance correction requests for the review screen.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !canReview(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const statusParam = new URL(req.url).searchParams.get("status") ?? "PENDING";
    const status =
        statusParam === "PENDING" || statusParam === "APPROVED" || statusParam === "REJECTED"
            ? statusParam
            : null;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const [requests, pendingCount] = await Promise.all([
            tx.attendanceCorrectionRequest.findMany({
                where: { courseId, ...(status ? { status } : {}) },
                // Oldest first while waiting (first come, first served);
                // newest first once it is history.
                orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
                take: 500,
            }),
            tx.attendanceCorrectionRequest.count({ where: { courseId, status: "PENDING" } }),
        ]);
        return NextResponse.json({ requests, pendingCount });
    });
}

/**
 * PATCH /api/admin/attendance-corrections — approve or reject one request.
 *
 * Approving rewrites the student's record for that roll call in the same
 * transaction, so the request can never say "approved" over an unchanged day.
 */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !canReview(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const parsed = decideSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" },
            { status: 400 }
        );
    }
    const { id, decision, reviewNote } = parsed.data;
    const approved = decision === "APPROVED";

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Claim it only while it is still pending: two reviewers clicking
            // at once must not both decide the same request.
            const claimed = await tx.attendanceCorrectionRequest.updateMany({
                where: { id, courseId, status: "PENDING" },
                data: {
                    status: decision,
                    reviewNote: reviewNote || null,
                    reviewedByUid: user.id,
                    reviewedByName: user.displayName,
                    reviewedAt: new Date(),
                },
            });
            const request = await tx.attendanceCorrectionRequest.findFirst({ where: { id, courseId } });
            if (!request) return { error: "আবেদনটি পাওয়া যায়নি।", status: 404 as const };
            if (claimed.count === 0) {
                return { error: "এই আবেদনের সিদ্ধান্ত আগেই দেওয়া হয়েছে।", status: 409 as const };
            }

            if (approved) {
                await tx.attendanceRecord.upsert({
                    where: { sessionId_studentId: { sessionId: request.sessionId, studentId: request.studentId } },
                    update: { status: request.requestedStatus },
                    // The roll call was re-saved without this student in the
                    // meantime; the approval still stands.
                    create: {
                        courseId,
                        sessionId: request.sessionId,
                        studentId: request.studentId,
                        roll: request.roll,
                        studentName: request.studentName,
                        status: request.requestedStatus,
                    },
                });
            }

            await logActivity(tx, {
                courseId,
                actorUid: user.id,
                actorRole: user.role === "teacher" ? "TEACHER" : "ADMIN",
                actionType: approved ? "ATTENDANCE_CORRECTION_APPROVED" : "ATTENDANCE_CORRECTION_REJECTED",
                targetType: "attendance_correction_request",
                targetId: request.id,
                description: `${user.displayName} ${request.batchName} ব্যাচের রোল ${request.roll}-এর ${request.date} তারিখের হাজিরা সংশোধনের আবেদন ${
                    approved ? "মঞ্জুর" : "নাকচ"
                } করেছেন`,
            });

            return { request };
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        // The student asked and is waiting on the answer — tell them, without
        // making the reviewer wait on the mail server.
        notifyStudentOfAttendanceCorrection({
            courseId,
            batchName: result.request.batchName,
            roll: result.request.roll,
            studentName: result.request.studentName,
            approved,
            date: result.request.date,
            requestedLabel: ATTENDANCE_LABELS[result.request.requestedStatus],
            reviewNote: result.request.reviewNote,
        });

        return NextResponse.json({ request: result.request });
    } catch (error) {
        console.error("Failed to decide attendance correction request:", error);
        return NextResponse.json({ error: "সিদ্ধান্ত সেভ করা যায়নি।" }, { status: 500 });
    }
}
