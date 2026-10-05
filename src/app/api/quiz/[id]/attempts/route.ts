import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/quiz/[id]/attempts — every attempt of one quiz (no answer bodies), for the teacher results table. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id: quizId } = await params;

    const attempts = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.quizAttempt.findMany({
            where: { quizId, courseId },
            select: {
                id: true, studentName: true, studentRoll: true, studentBatchName: true, attemptNumber: true,
                isPractice: true, status: true, score: true, totalMarks: true, percentage: true, passed: true,
                tabSwitchCount: true, liveSessionId: true, startedAt: true, submittedAt: true, durationTakenSeconds: true,
            },
            orderBy: { startedAt: "desc" },
        })
    );
    return NextResponse.json(attempts);
}
