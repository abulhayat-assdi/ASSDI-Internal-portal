import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { seededShuffle } from "@/lib/quiz/shuffle";
import { stripCorrectness, type QuizOptionData } from "@/lib/quiz/grading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/student/quiz/[id]?practice=true
 *
 * Resumes the caller's in-progress attempt if one exists, otherwise starts a
 * new one (subject to maxAttempts / practiceModeAllowed) with a locked-in
 * shuffled question order. Never returns answer keys.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id: quizId } = await params;
    const wantsPractice = new URL(req.url).searchParams.get("practice") === "true";

    try {
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const quiz = await tx.quiz.findFirst({
                where: { id: quizId, courseId, isActive: true },
                include: { questions: { orderBy: { order: "asc" } } },
            });
            if (!quiz) return { error: "not-found" as const };

            const now = new Date();
            const batchNames = Array.isArray(quiz.batchNames) ? (quiz.batchNames as unknown[]) : [];
            const studentBatchName = user.studentBatchName || "";
            const inBatch = batchNames.some((b) => b === studentBatchName || b === "all");
            if (!inBatch) return { error: "not-found" as const };
            if (quiz.scheduleStart && now < quiz.scheduleStart) return { error: "not-open" as const };
            if (quiz.scheduleEnd && now > quiz.scheduleEnd) return { error: "closed" as const };
            if (quiz.questions.length === 0) return { error: "not-found" as const };

            const isPractice = wantsPractice && quiz.practiceModeAllowed;

            const existing = await tx.quizAttempt.findFirst({
                where: { courseId, quizId, studentUserId: user.id, status: "IN_PROGRESS", isPractice },
            });

            let attempt = existing;
            if (!attempt) {
                const gradedCount = await tx.quizAttempt.count({
                    where: { courseId, quizId, studentUserId: user.id, isPractice: false },
                });
                if (!isPractice && gradedCount >= quiz.maxAttempts) {
                    return { error: "attempts-exhausted" as const };
                }

                const attemptId = randomUUID();
                const allIds = quiz.questions.map((q) => q.id);
                const orderedIds = quiz.shuffleQuestions ? seededShuffle(allIds, attemptId) : allIds;

                attempt = await tx.quizAttempt.create({
                    data: {
                        id: attemptId,
                        courseId,
                        quizId,
                        studentUserId: user.id,
                        studentName: user.displayName,
                        studentRoll: user.studentRoll || "",
                        studentBatchName,
                        attemptNumber: isPractice ? 0 : gradedCount + 1,
                        isPractice,
                        status: "IN_PROGRESS",
                        questionOrder: orderedIds,
                    },
                });
            }

            const savedAnswers = await tx.quizAnswer.findMany({
                where: { attemptId: attempt.id, courseId },
                select: { questionId: true, selectedOptionIds: true, shortAnswerText: true },
            });

            const questionById = new Map(quiz.questions.map((q) => [q.id, q]));
            const orderedIds = Array.isArray(attempt.questionOrder) ? (attempt.questionOrder as string[]) : [];

            const questions = orderedIds
                .map((qid) => questionById.get(qid))
                .filter((q): q is NonNullable<typeof q> => Boolean(q))
                .map((q) => {
                    const options = (q.options as unknown as QuizOptionData[]) || [];
                    const ordered = quiz.shuffleOptions ? seededShuffle(options, `${attempt!.id}:${q.id}`) : options;
                    return {
                        id: q.id,
                        type: q.type,
                        bodyHtml: q.bodyHtml,
                        marks: q.marks,
                        options: stripCorrectness(ordered),
                    };
                });

            return {
                error: null,
                attemptId: attempt.id,
                status: attempt.status,
                isPractice: attempt.isPractice,
                attemptNumber: attempt.attemptNumber,
                quiz: {
                    title: quiz.title,
                    descriptionHtml: quiz.descriptionHtml,
                    durationSeconds: quiz.durationSeconds,
                    allowBacktrack: quiz.allowBacktrack,
                    optionLabelStyle: quiz.optionLabelStyle,
                    maxAttempts: quiz.maxAttempts,
                },
                startedAt: attempt.startedAt,
                questions,
                savedAnswers,
            };
        });

        if (result.error) {
            const statusByError: Record<string, number> = {
                "not-found": 404, "not-open": 403, closed: 403, "attempts-exhausted": 409,
            };
            return NextResponse.json({ error: result.error }, { status: statusByError[result.error] ?? 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[Student Quiz Detail GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
