import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logQuizActivity } from "@/lib/quizLog";
import { gradeAnswer, computeAttemptTotals, type QuizOptionData, type GradedAnswer } from "@/lib/quiz/grading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST — finalizes an attempt. The server re-grades every saved answer from
 * the question's stored answer key; nothing the client claims about
 * correctness is ever trusted.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id: quizId, attemptId } = await params;

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const attempt = await tx.quizAttempt.findFirst({
                where: { id: attemptId, courseId, quizId, studentUserId: user.id },
            });
            if (!attempt) return null;
            if (attempt.status !== "IN_PROGRESS") return "already-submitted" as const;

            const [quiz, questions, savedAnswers] = await Promise.all([
                tx.quiz.findFirst({ where: { id: quizId, courseId }, select: { title: true, negativeMarkPerWrong: true, passPercentage: true } }),
                tx.quizQuestion.findMany({ where: { quizId, courseId }, select: { id: true, type: true, marks: true, options: true } }),
                tx.quizAnswer.findMany({ where: { attemptId, courseId } }),
            ]);
            if (!quiz) return null;

            const answersByQuestionId = new Map<string, GradedAnswer>();

            for (const q of questions) {
                const saved = savedAnswers.find((a) => a.questionId === q.id);
                const graded = gradeAnswer(
                    {
                        id: q.id,
                        type: q.type,
                        marks: q.marks,
                        options: (q.options as unknown as QuizOptionData[]) || [],
                    },
                    saved ? ((saved.selectedOptionIds as unknown as string[]) || []) : [],
                    quiz.negativeMarkPerWrong
                );
                answersByQuestionId.set(q.id, graded);
                if (saved) {
                    await tx.quizAnswer.update({
                        where: { id: saved.id },
                        data: { isCorrect: graded.isCorrect, marksAwarded: graded.marksAwarded },
                    });
                }
            }

            const totals = computeAttemptTotals(questions, answersByQuestionId, quiz.passPercentage);
            const durationTakenSeconds = Math.max(0, Math.round((Date.now() - attempt.startedAt.getTime()) / 1000));

            const updated = await tx.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    status: totals.hasUngraded ? "AWAITING_GRADING" : "SUBMITTED",
                    score: totals.score,
                    totalMarks: totals.totalMarks,
                    percentage: totals.percentage,
                    passed: totals.passed,
                    submittedAt: new Date(),
                    durationTakenSeconds,
                },
            });

            await logQuizActivity(tx, user, {
                action: "QUIZ_ATTEMPT_SUBMITTED",
                targetType: "quiz_attempt",
                targetId: attemptId,
                description: `${user.displayName} submitted an attempt for quiz "${quiz.title}"`,
            });

            return updated;
        });

        if (result === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (result === "already-submitted") {
            return NextResponse.json({ error: "Attempt already submitted" }, { status: 409 });
        }
        return NextResponse.json({ status: result.status });
    } catch (error) {
        console.error("[Quiz Submit POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
