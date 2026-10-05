import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { clientClock, finishSession, loadLiveSession, optionCounts, optionsOf, rankSession } from "@/lib/quiz/liveServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — host view: state, the current question WITH answer key, pick counts and the live ranking. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { sessionId } = await params;

    const data = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const live = await loadLiveSession(tx, courseId, sessionId);
        if (!live) return null;
        const clock = clientClock(live);
        const ranking = await rankSession(tx, courseId, sessionId);
        const counts = live.current ? await optionCounts(tx, courseId, sessionId, live.current.id) : { answered: 0, counts: {} };
        return {
            id: live.session.id,
            quizId: live.quiz.id,
            quizTitle: live.quiz.title,
            joinCode: live.session.joinCode,
            optionLabelStyle: live.quiz.optionLabelStyle,
            ...clock,
            currentIndex: live.session.currentIndex,
            totalQuestions: live.order.length,
            question: live.current
                ? { id: live.current.id, type: live.current.type, bodyHtml: live.current.bodyHtml, marks: live.current.marks, options: optionsOf(live.current), explanationHtml: live.current.explanationHtml }
                : null,
            answered: counts.answered,
            optionCounts: counts.counts,
            playerCount: ranking.length,
            players: ranking.map((r) => ({ name: r.name, roll: r.roll })),
            leaderboard: ranking.slice(0, 10),
        };
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
}

/** POST { action: "next" | "reveal" | "end" } — host controls. "next" also starts the first question from the lobby. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { sessionId } = await params;
    const { action } = (await req.json().catch(() => ({}))) as { action?: string };
    if (action !== "next" && action !== "reveal" && action !== "end") {
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const live = await loadLiveSession(tx, courseId, sessionId);
        if (!live) return "not-found" as const;
        if (live.session.status === "FINISHED") return "finished" as const;
        const totalMarks = live.order.reduce((sum, q) => sum + q.marks, 0);

        if (action === "end") {
            await finishSession(tx, courseId, sessionId, totalMarks, live.quiz.passPercentage);
            return "ok" as const;
        }
        if (action === "reveal") {
            if (live.session.status !== "QUESTION") return "bad-state" as const;
            await tx.quizLiveSession.update({ where: { id: sessionId }, data: { status: "REVEAL" } });
            return "ok" as const;
        }
        // next
        const nextIndex = live.session.currentIndex + 1;
        if (nextIndex >= live.order.length) {
            await finishSession(tx, courseId, sessionId, totalMarks, live.quiz.passPercentage);
            return "ok" as const;
        }
        await tx.quizLiveSession.update({
            where: { id: sessionId },
            data: { status: "QUESTION", currentIndex: nextIndex, questionStartedAt: new Date() },
        });
        return "ok" as const;
    });

    if (result === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result === "finished") return NextResponse.json({ error: "Session already finished" }, { status: 409 });
    if (result === "bad-state") return NextResponse.json({ error: "No open question" }, { status: 409 });
    return NextResponse.json({ ok: true });
}
