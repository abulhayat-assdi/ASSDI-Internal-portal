import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/quiz/[id]/grading — short-answer responses for one quiz, pending (isCorrect null) and already graded. */
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
            select: { id: true, bodyHtml: true, marks: true, type: true },
        });
        const shortIds = questions.filter((q) => q.type === "SHORT_ANSWER").map((q) => q.id);
        const questionById = new Map(questions.map((q) => [q.id, q]));

        const attempts = await tx.quizAttempt.findMany({
            where: { quizId: id, courseId, isPractice: false, status: { in: ["AWAITING_GRADING", "GRADED"] } },
            // Graded short answers stay listed (isCorrect set) so a mistaken grade can be flipped.
            include: { answers: { where: { questionId: { in: shortIds } } } },
            orderBy: { submittedAt: "asc" },
        });

        return attempts.filter((a) => a.answers.length > 0).map((a) => ({
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
                isCorrect: ans.isCorrect,
            })),
        }));
    });

    return NextResponse.json(data);
}
