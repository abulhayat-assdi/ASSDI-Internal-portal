import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/student/quiz
 * Lists quizzes currently live for the caller's own batch, with their own
 * attempt history so the UI can show start / in-progress / exhausted state
 * without leaking questions or answer keys. Mirrors GET /api/student/typing-exam.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const studentBatchName = user.studentBatchName || "";

    try {
        const now = new Date();

        const quizzes = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const candidates = await tx.quiz.findMany({
                where: { courseId, isActive: true },
                include: { _count: { select: { questions: true } } },
                orderBy: { createdAt: "desc" },
            });

            const visible = candidates.filter((quiz) => {
                const batchNames = Array.isArray(quiz.batchNames) ? (quiz.batchNames as unknown[]) : [];
                if (!batchNames.some((b) => b === studentBatchName || b === "all")) return false;
                if (quiz.scheduleStart && now < quiz.scheduleStart) return false;
                if (quiz.scheduleEnd && now > quiz.scheduleEnd) return false;
                return quiz._count.questions > 0;
            });

            if (visible.length === 0) return [];

            const attempts = await tx.quizAttempt.findMany({
                where: { courseId, quizId: { in: visible.map((q) => q.id) }, studentUserId: user.id },
                orderBy: { startedAt: "desc" },
            });

            return visible.map((quiz) => {
                const own = attempts.filter((a) => a.quizId === quiz.id);
                const graded = own.filter((a) => !a.isPractice);
                // Practice and live-session attempts are also "in progress" rows; only a graded one is resumable from the list.
                const inProgress = own.find((a) => a.status === "IN_PROGRESS" && !a.isPractice);
                return {
                    id: quiz.id,
                    title: quiz.title,
                    descriptionHtml: quiz.descriptionHtml,
                    durationSeconds: quiz.durationSeconds,
                    maxAttempts: quiz.maxAttempts,
                    attemptsUsed: graded.length,
                    practiceModeAllowed: quiz.practiceModeAllowed,
                    scheduleEnd: quiz.scheduleEnd,
                    inProgressAttemptId: inProgress?.id ?? null,
                    questionCount: quiz._count.questions,
                };
            });
        });

        return NextResponse.json(quizzes);
    } catch (error) {
        console.error("[Student Quiz GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
