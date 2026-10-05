import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { QuizOptionData } from "@/lib/quiz/grading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET — the student's own result for one attempt, gated on the quiz's
 * resultReleaseMode. A practice attempt is always visible immediately
 * regardless of that setting (it was never meant to be withheld).
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id: quizId, attemptId } = await params;

    const data = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const attempt = await tx.quizAttempt.findFirst({
            where: { id: attemptId, courseId, quizId, studentUserId: user.id },
        });
        if (!attempt) return { error: "not-found" as const };
        if (attempt.status === "IN_PROGRESS") return { error: "not-submitted" as const };

        const quiz = await tx.quiz.findFirst({ where: { id: quizId, courseId } });
        if (!quiz) return { error: "not-found" as const };

        const now = new Date();
        const released =
            attempt.isPractice ||
            quiz.resultReleaseMode === "IMMEDIATE" ||
            Boolean(quiz.resultsReleasedAt) ||
            (quiz.resultReleaseAt != null && now >= quiz.resultReleaseAt);

        if (!released) {
            return { error: null, released: false, status: attempt.status };
        }

        const [questions, answers] = await Promise.all([
            tx.quizQuestion.findMany({ where: { quizId, courseId }, orderBy: { order: "asc" } }),
            tx.quizAnswer.findMany({ where: { attemptId, courseId } }),
        ]);
        const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a]));
        const orderedIds = Array.isArray(attempt.questionOrder) ? (attempt.questionOrder as string[]) : questions.map((q) => q.id);
        const questionById = new Map(questions.map((q) => [q.id, q]));

        const review = orderedIds
            .map((qid) => questionById.get(qid))
            .filter((q): q is NonNullable<typeof q> => Boolean(q))
            .map((q) => {
                const answer = answerByQuestionId.get(q.id);
                const options = (q.options as unknown as QuizOptionData[]) || [];
                return {
                    questionId: q.id,
                    type: q.type,
                    bodyHtml: q.bodyHtml,
                    marks: q.marks,
                    explanationHtml: q.explanationHtml,
                    options: options.map((o) => ({ id: o.id, textHtml: o.textHtml, isCorrect: o.isCorrect })),
                    selectedOptionIds: (answer?.selectedOptionIds as unknown as string[]) || [],
                    shortAnswerText: answer?.shortAnswerText ?? null,
                    isCorrect: answer?.isCorrect ?? null,
                    marksAwarded: answer?.marksAwarded ?? 0,
                    pendingManualGrading: q.type === "SHORT_ANSWER" && answer != null && answer.isCorrect === null,
                };
            });

        return {
            error: null,
            released: true,
            status: attempt.status,
            score: attempt.score,
            totalMarks: attempt.totalMarks,
            percentage: attempt.percentage,
            passed: attempt.passed,
            tabSwitchCount: attempt.tabSwitchCount,
            durationTakenSeconds: attempt.durationTakenSeconds,
            review,
        };
    });

    if (data.error) {
        return NextResponse.json({ error: data.error }, { status: data.error === "not-found" ? 404 : 409 });
    }
    return NextResponse.json(data);
}
