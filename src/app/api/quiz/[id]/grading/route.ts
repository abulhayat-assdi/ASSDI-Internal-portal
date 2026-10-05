import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/quiz/[id]/grading — the manual short-answer grading queue for one quiz. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    const data = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const questions = await tx.quizQuestion.findMany({
            where: { quizId: id, courseId },
            select: { id: true, bodyHtml: true, marks: true },
        });
        const questionById = new Map(questions.map((q) => [q.id, q]));

        const attempts = await tx.quizAttempt.findMany({
            where: { quizId: id, courseId, status: "AWAITING_GRADING" },
            include: { answers: { where: { isCorrect: null } } },
            orderBy: { submittedAt: "asc" },
        });

        return attempts.map((a) => ({
            attemptId: a.id,
            studentName: a.studentName,
            studentRoll: a.studentRoll,
            studentBatchName: a.studentBatchName,
            submittedAt: a.submittedAt,
            answers: a.answers.map((ans) => ({
                answerId: ans.id,
                questionId: ans.questionId,
                questionBodyHtml: questionById.get(ans.questionId)?.bodyHtml ?? "",
                questionMarks: questionById.get(ans.questionId)?.marks ?? 0,
                shortAnswerText: ans.shortAnswerText,
            })),
        }));
    });

    return NextResponse.json(data);
}
