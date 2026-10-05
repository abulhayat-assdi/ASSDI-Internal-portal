import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST { code } — join a hosted live session from the student portal. */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    const joinCode = String(code || "").trim();
    if (!/^\d{6}$/.test(joinCode)) return NextResponse.json({ error: "invalid-code" }, { status: 400 });

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const session = await tx.quizLiveSession.findFirst({
            where: { courseId, joinCode, status: { not: "FINISHED" } },
            orderBy: { createdAt: "desc" },
        });
        if (!session) return { error: "invalid-code" as const };

        const quiz = await tx.quiz.findFirst({ where: { id: session.quizId, courseId } });
        if (!quiz) return { error: "invalid-code" as const };
        const batchNames = Array.isArray(quiz.batchNames) ? (quiz.batchNames as unknown[]) : [];
        const studentBatchName = user.studentBatchName || "";
        if (!batchNames.some((b) => b === studentBatchName || b === "all")) return { error: "not-your-batch" as const };

        const existing = await tx.quizAttempt.findFirst({ where: { courseId, liveSessionId: session.id, studentUserId: user.id } });
        if (!existing) {
            // Late joiners are fine: they simply start with 0 points. Live attempts are
            // flagged practice so they never use up a self-paced attempt or skew its stats.
            await tx.quizAttempt.create({
                data: {
                    courseId,
                    quizId: quiz.id,
                    liveSessionId: session.id,
                    studentUserId: user.id,
                    studentName: user.displayName,
                    studentRoll: user.studentRoll || "",
                    studentBatchName,
                    attemptNumber: 0,
                    isPractice: true,
                    status: "IN_PROGRESS",
                    questionOrder: session.questionOrder ?? [],
                },
            });
        }
        return { error: null, sessionId: session.id };
    });

    if (result.error === "invalid-code") return NextResponse.json({ error: "invalid-code" }, { status: 404 });
    if (result.error === "not-your-batch") return NextResponse.json({ error: "not-your-batch" }, { status: 403 });
    return NextResponse.json({ sessionId: result.sessionId });
}
