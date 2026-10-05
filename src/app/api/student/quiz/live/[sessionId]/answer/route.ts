import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { gradeAnswer } from "@/lib/quiz/grading";
import { canAnswer, speedScaledMarks } from "@/lib/quiz/live";
import { loadLiveSession, optionsOf } from "@/lib/quiz/liveServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { questionId, selectedOptionIds } — one locked answer per player per question.
 * Scored here, from the server's clock: correct answers earn marks scaled by speed,
 * wrong ones lose the quiz's negative mark.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { sessionId } = await params;
    const { questionId, selectedOptionIds } = (await req.json().catch(() => ({}))) as { questionId?: string; selectedOptionIds?: string[] };
    if (!questionId || !Array.isArray(selectedOptionIds)) {
        return NextResponse.json({ error: "questionId and selectedOptionIds required" }, { status: 400 });
    }

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const mine = await tx.quizAttempt.findFirst({ where: { courseId, liveSessionId: sessionId, studentUserId: user.id } });
        if (!mine) return "not-found" as const;
        const live = await loadLiveSession(tx, courseId, sessionId);
        if (!live || !live.current || live.current.id !== questionId) return "wrong-question" as const;
        const now = Date.now();
        if (!canAnswer(live.clock, now)) return "closed" as const;

        const already = await tx.quizAnswer.findUnique({ where: { attemptId_questionId: { attemptId: mine.id, questionId } } });
        if (already) return "already-answered" as const;

        const options = optionsOf(live.current);
        const valid = new Set(options.map((o) => o.id));
        const picked = selectedOptionIds.filter((id) => valid.has(id));
        if (picked.length === 0) return "empty" as const;

        const responseMs = Math.max(0, now - (live.session.questionStartedAt?.getTime() ?? now));
        const graded = gradeAnswer(
            { id: live.current.id, type: live.current.type, marks: live.current.marks, options },
            picked,
            live.quiz.negativeMarkPerWrong
        );
        const marksAwarded = graded.isCorrect
            ? speedScaledMarks(live.current.marks, responseMs, live.limitSeconds)
            : graded.marksAwarded;

        await tx.quizAnswer.create({
            data: { courseId, attemptId: mine.id, questionId, selectedOptionIds: picked, isCorrect: graded.isCorrect, marksAwarded, responseMs },
        });
        await tx.quizAttempt.update({ where: { id: mine.id }, data: { score: { increment: marksAwarded } } });
        return "ok" as const;
    });

    if (result === "ok") return NextResponse.json({ ok: true });
    const status = result === "not-found" ? 404 : result === "empty" ? 400 : 409;
    return NextResponse.json({ error: result }, { status });
}
