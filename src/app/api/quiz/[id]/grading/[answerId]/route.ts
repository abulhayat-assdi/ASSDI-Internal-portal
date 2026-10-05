import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { logQuizActivity } from "@/lib/quizLog";
import { computeAttemptTotals, type GradedAnswer } from "@/lib/quiz/grading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PATCH /api/quiz/[id]/grading/[answerId] — grade one short-answer answer. */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; answerId: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id: quizId, answerId } = await params;

    try {
        const body = await req.json();
        const isCorrect = Boolean(body.isCorrect);

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const answer = await tx.quizAnswer.findFirst({ where: { id: answerId, courseId } });
            if (!answer) return null;

            const attempt = await tx.quizAttempt.findFirst({ where: { id: answer.attemptId, courseId, quizId } });
            if (!attempt) return null;

            const question = await tx.quizQuestion.findFirst({ where: { id: answer.questionId, courseId } });
            if (!question) return null;

            const marksAwarded = isCorrect ? question.marks : 0;
            await tx.quizAnswer.update({
                where: { id: answerId },
                data: { isCorrect, marksAwarded },
            });

            // Recompute the attempt's totals from every answer now on record.
            const [questions, answers] = await Promise.all([
                tx.quizQuestion.findMany({ where: { quizId, courseId }, select: { id: true, marks: true } }),
                tx.quizAnswer.findMany({ where: { attemptId: attempt.id, courseId } }),
            ]);
            const answersByQuestionId = new Map<string, GradedAnswer>(
                answers.map((a) => [a.questionId, { isCorrect: a.isCorrect, marksAwarded: a.marksAwarded }])
            );

            const quiz = await tx.quiz.findFirst({ where: { id: quizId, courseId }, select: { passPercentage: true, title: true } });
            const totals = computeAttemptTotals(questions, answersByQuestionId, quiz?.passPercentage ?? null);

            const updatedAttempt = await tx.quizAttempt.update({
                where: { id: attempt.id },
                data: {
                    score: totals.score,
                    totalMarks: totals.totalMarks,
                    percentage: totals.percentage,
                    passed: totals.passed,
                    status: totals.hasUngraded ? "AWAITING_GRADING" : "GRADED",
                },
            });

            await logQuizActivity(tx, user, {
                action: "QUIZ_ANSWER_GRADED",
                targetType: "quiz_answer",
                targetId: answerId,
                description: `${user.displayName} graded a short-answer response for "${quiz?.title ?? quizId}" (${isCorrect ? "correct" : "incorrect"})`,
            });

            return updatedAttempt;
        });

        if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(result);
    } catch (error) {
        console.error("[Grading PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
