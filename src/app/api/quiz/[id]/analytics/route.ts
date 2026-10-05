import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/quiz/[id]/analytics — per-question correct/wrong breakdown,
 * attempt count, average score, and a leaderboard. Real (non-practice),
 * finished attempts only — an in-progress or practice run should not skew
 * "which question is everyone missing".
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id: quizId } = await params;

    const data = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const questions = await tx.quizQuestion.findMany({
            where: { quizId, courseId },
            select: { id: true, bodyHtml: true, order: true },
            orderBy: { order: "asc" },
        });

        const finishedAttempts = await tx.quizAttempt.findMany({
            where: { quizId, courseId, isPractice: false, status: { in: ["SUBMITTED", "GRADED"] } },
            select: {
                id: true, studentName: true, studentRoll: true, studentBatchName: true,
                score: true, totalMarks: true, percentage: true, durationTakenSeconds: true,
            },
        });
        const attemptIds = finishedAttempts.map((a) => a.id);

        const answers = attemptIds.length
            ? await tx.quizAnswer.groupBy({
                  by: ["questionId", "isCorrect"],
                  where: { attemptId: { in: attemptIds }, courseId },
                  _count: { _all: true },
              })
            : [];

        const perQuestion = questions.map((q) => {
            const rows = answers.filter((a) => a.questionId === q.id);
            const correct = rows.find((r) => r.isCorrect === true)?._count._all ?? 0;
            const wrong = rows.find((r) => r.isCorrect === false)?._count._all ?? 0;
            const ungraded = rows.find((r) => r.isCorrect === null)?._count._all ?? 0;
            const answered = correct + wrong + ungraded;
            return {
                questionId: q.id,
                order: q.order,
                bodyHtml: q.bodyHtml,
                correct,
                wrong,
                ungraded,
                answered,
                correctRate: answered > 0 ? correct / answered : null,
            };
        });

        const averagePercentage = finishedAttempts.length
            ? finishedAttempts.reduce((sum, a) => sum + a.percentage, 0) / finishedAttempts.length
            : 0;

        const leaderboard = [...finishedAttempts]
            .sort((a, b) => b.score - a.score || (a.durationTakenSeconds ?? Infinity) - (b.durationTakenSeconds ?? Infinity))
            .slice(0, 20)
            .map((a) => ({
                studentName: a.studentName,
                studentRoll: a.studentRoll,
                studentBatchName: a.studentBatchName,
                score: a.score,
                totalMarks: a.totalMarks,
                percentage: a.percentage,
                durationTakenSeconds: a.durationTakenSeconds,
            }));

        return {
            attemptCount: finishedAttempts.length,
            averagePercentage,
            perQuestion,
            leaderboard,
        };
    });

    return NextResponse.json(data);
}
