import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { stripCorrectness } from "@/lib/quiz/grading";
import { clientClock, loadLiveSession, optionCounts, optionsOf, rankSession } from "@/lib/quiz/liveServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — polled by the student's phone/laptop. Answer keys only appear once the question is in REVEAL. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { sessionId } = await params;

    const data = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const mine = await tx.quizAttempt.findFirst({ where: { courseId, liveSessionId: sessionId, studentUserId: user.id } });
        if (!mine) return null;
        const live = await loadLiveSession(tx, courseId, sessionId);
        if (!live) return null;

        const clock = clientClock(live);
        const ranking = await rankSession(tx, courseId, sessionId);
        const me = ranking.find((r) => r.studentUserId === user.id);
        const showNames = live.quiz.leaderboardShowNames;
        const board = ranking.slice(0, 5).map((r) => ({
            rank: r.rank,
            name: showNames || r.studentUserId === user.id ? r.name : `Student ${r.rank}`,
            score: r.score,
            isMe: r.studentUserId === user.id,
        }));

        let question = null;
        let myAnswer = null;
        let correctOptionIds: string[] | null = null;
        let pickCounts: Record<string, number> | null = null;
        if (live.current && (clock.status === "QUESTION" || clock.status === "REVEAL")) {
            const options = optionsOf(live.current);
            question = {
                id: live.current.id,
                type: live.current.type,
                bodyHtml: live.current.bodyHtml,
                marks: live.current.marks,
                options: stripCorrectness(options),
            };
            const saved = await tx.quizAnswer.findUnique({
                where: { attemptId_questionId: { attemptId: mine.id, questionId: live.current.id } },
            });
            if (saved) {
                myAnswer = {
                    selectedOptionIds: saved.selectedOptionIds as unknown as string[],
                    isCorrect: saved.isCorrect,
                    marksAwarded: saved.marksAwarded,
                };
            }
            if (clock.status === "REVEAL") {
                correctOptionIds = options.filter((o) => o.isCorrect).map((o) => o.id);
                pickCounts = (await optionCounts(tx, courseId, sessionId, live.current.id)).counts;
            }
        }

        return {
            quizTitle: live.quiz.title,
            optionLabelStyle: live.quiz.optionLabelStyle,
            ...clock,
            currentIndex: live.session.currentIndex,
            totalQuestions: live.order.length,
            playerCount: ranking.length,
            question,
            myAnswer,
            // Only revealed with the answer key, so a fast player can't see a hint early.
            correctOptionIds,
            pickCounts,
            explanationHtml: clock.status === "REVEAL" ? live.current?.explanationHtml ?? "" : "",
            me: me ? { rank: me.rank, score: me.score } : null,
            leaderboard: clock.status === "REVEAL" || clock.status === "FINISHED" ? board : [],
        };
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
}
