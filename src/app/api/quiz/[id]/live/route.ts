import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { generateJoinCode } from "@/lib/quiz/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/quiz/[id]/live — host a new live session of this quiz. Short-answer questions are skipped (they cannot be auto-scored live). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id: quizId } = await params;
    const body = await req.json().catch(() => ({}));
    const seconds = Number(body.defaultQuestionSeconds);
    const defaultQuestionSeconds = Number.isFinite(seconds) ? Math.min(300, Math.max(5, Math.round(seconds))) : 20;

    const created = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const quiz = await tx.quiz.findFirst({
            where: { id: quizId, courseId },
            include: { questions: { orderBy: { order: "asc" } } },
        });
        if (!quiz) return { error: "not-found" as const };
        const playable = quiz.questions.filter((q) => q.type !== "SHORT_ANSWER");
        if (playable.length === 0) return { error: "no-questions" as const };

        // A code only has to be unique among sessions that can still be joined.
        let joinCode = generateJoinCode();
        for (let i = 0; i < 10; i++) {
            const clash = await tx.quizLiveSession.findFirst({
                where: { courseId, joinCode, status: { not: "FINISHED" } },
                select: { id: true },
            });
            if (!clash) break;
            joinCode = generateJoinCode();
        }

        const session = await tx.quizLiveSession.create({
            data: {
                courseId,
                quizId,
                joinCode,
                questionOrder: playable.map((q) => q.id),
                defaultQuestionSeconds,
                hostUid: user.id,
                hostName: user.displayName,
            },
        });
        return { error: null, session };
    });

    if (created.error === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (created.error === "no-questions") {
        return NextResponse.json({ error: "Add at least one multiple-choice or true/false question first" }, { status: 400 });
    }
    return NextResponse.json({ id: created.session!.id, joinCode: created.session!.joinCode }, { status: 201 });
}
