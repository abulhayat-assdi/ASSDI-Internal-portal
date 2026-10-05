import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadVisibleExam } from "@/lib/typing-exam/visibility";
import { cleanExamText } from "@/lib/typing-exam/examText";
import { countUsedAttempts } from "@/lib/typing-exam/retryGate";
import { finalizeStaleSessions } from "@/lib/typing-exam/sessionStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/student/typing-exam/[id]
 * Returns the exam passage + duration for a student who is eligible to
 * start it. Does not create an attempt row (the attempt endpoint does).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const studentBatchName = user.studentBatchName || "";
    const { id } = await params;

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const result = await loadVisibleExam(tx, courseId, id, studentBatchName);
            if ("error" in result) {
                return NextResponse.json({ error: result.error }, { status: result.status });
            }
            const { exam } = result;

            await finalizeStaleSessions(tx, { courseId, examId: exam.id });
            // Includes a run still in flight (e.g. this page reloaded mid-exam),
            // so the ready screen asks for the retry password when it must.
            const attemptsUsed = await countUsedAttempts(tx, courseId, exam.id, { studentUserId: user.id });

            return NextResponse.json({
                id: exam.id,
                title: exam.title,
                examText: cleanExamText(exam.examText),
                durationSeconds: exam.durationSeconds,
                attemptsUsed,
            });
        });
    } catch (error) {
        console.error("[Student TypingExam Detail GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
