import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadVisibleExam } from "@/lib/typing-exam/visibility";

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

            const attemptsUsed = await tx.typingExamAttempt.count({
                where: {
                    courseId,
                    examId: exam.id,
                    takerType: "STUDENT",
                    studentUserId: user.id,
                },
            });

            if (attemptsUsed >= exam.maxAttempts) {
                return NextResponse.json(
                    { error: "You have used all your attempts for this exam" },
                    { status: 403 }
                );
            }

            return NextResponse.json({
                id: exam.id,
                title: exam.title,
                examText: exam.examText,
                durationSeconds: exam.durationSeconds,
            });
        });
    } catch (error) {
        console.error("[Student TypingExam Detail GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
