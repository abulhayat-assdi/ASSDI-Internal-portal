import type { Prisma } from "@prisma/client";
import { compareRank, remainingMs, effectiveStatus, type LiveStatus } from "./live";
import type { QuizOptionData } from "./grading";

type Tx = Prisma.TransactionClient;

export interface LiveRankRow {
    attemptId: string;
    studentUserId: string;
    name: string;
    roll: string;
    score: number;
    totalResponseMs: number;
    rank: number;
}

/** Everything the live screens need, derived from the session row + its quiz. */
export async function loadLiveSession(tx: Tx, courseId: string, sessionId: string) {
    const session = await tx.quizLiveSession.findFirst({ where: { id: sessionId, courseId } });
    if (!session) return null;
    const quiz = await tx.quiz.findFirst({ where: { id: session.quizId, courseId } });
    if (!quiz) return null;
    const questions = await tx.quizQuestion.findMany({ where: { quizId: quiz.id, courseId } });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const order = (Array.isArray(session.questionOrder) ? (session.questionOrder as string[]) : [])
        .map((id) => byId.get(id))
        .filter((q): q is NonNullable<typeof q> => Boolean(q));
    const current = session.currentIndex >= 0 ? order[session.currentIndex] ?? null : null;
    const limitSeconds = current?.timeLimitSeconds ?? session.defaultQuestionSeconds;
    const clock = { status: session.status as LiveStatus, questionStartedAt: session.questionStartedAt, limitSeconds };
    return { session, quiz, order, current, limitSeconds, clock };
}

export type LoadedLive = NonNullable<Awaited<ReturnType<typeof loadLiveSession>>>;

export function clientClock(live: LoadedLive, now = Date.now()) {
    return {
        status: effectiveStatus(live.clock, now),
        remainingMs: remainingMs(live.clock, now),
        limitSeconds: live.limitSeconds,
    };
}

/** Ranked players of a session, best first. */
export async function rankSession(tx: Tx, courseId: string, sessionId: string): Promise<LiveRankRow[]> {
    const attempts = await tx.quizAttempt.findMany({
        where: { courseId, liveSessionId: sessionId },
        select: { id: true, studentUserId: true, studentName: true, studentRoll: true, score: true },
    });
    if (attempts.length === 0) return [];
    const times = await tx.quizAnswer.groupBy({
        by: ["attemptId"],
        where: { courseId, attemptId: { in: attempts.map((a) => a.id) } },
        _sum: { responseMs: true },
    });
    const timeByAttempt = new Map(times.map((t) => [t.attemptId, t._sum.responseMs ?? 0]));
    const rows = attempts
        .map((a) => ({
            attemptId: a.id,
            studentUserId: a.studentUserId,
            name: a.studentName,
            roll: a.studentRoll,
            score: Math.round(a.score * 10) / 10,
            totalResponseMs: timeByAttempt.get(a.id) ?? 0,
        }))
        .sort(compareRank);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Per-option pick counts for the current question, for the host chart. */
export async function optionCounts(tx: Tx, courseId: string, sessionId: string, questionId: string) {
    const answers = await tx.quizAnswer.findMany({
        where: { courseId, questionId, attempt: { liveSessionId: sessionId } },
        select: { selectedOptionIds: true },
    });
    const counts: Record<string, number> = {};
    for (const a of answers) {
        for (const id of (a.selectedOptionIds as unknown as string[]) || []) counts[id] = (counts[id] || 0) + 1;
    }
    return { answered: answers.length, counts };
}

export function optionsOf(question: { options: unknown }): QuizOptionData[] {
    return ((question.options as unknown) as QuizOptionData[]) || [];
}

/** Closes a finished session: every player's attempt becomes a submitted result. */
export async function finishSession(tx: Tx, courseId: string, sessionId: string, totalMarks: number, passPercentage: number | null) {
    const attempts = await tx.quizAttempt.findMany({ where: { courseId, liveSessionId: sessionId, status: "IN_PROGRESS" } });
    for (const a of attempts) {
        const percentage = totalMarks > 0 ? (Math.max(0, a.score) / totalMarks) * 100 : 0;
        await tx.quizAttempt.update({
            where: { id: a.id },
            data: {
                status: "SUBMITTED",
                totalMarks,
                percentage,
                passed: passPercentage == null ? null : percentage >= passPercentage,
                submittedAt: new Date(),
                durationTakenSeconds: Math.max(0, Math.round((Date.now() - a.startedAt.getTime()) / 1000)),
            },
        });
    }
    await tx.quizLiveSession.update({ where: { id: sessionId }, data: { status: "FINISHED", endedAt: new Date() } });
}
