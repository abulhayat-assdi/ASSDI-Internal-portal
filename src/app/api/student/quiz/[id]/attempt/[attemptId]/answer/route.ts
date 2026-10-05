import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST — autosave one answer as the student progresses through the quiz. */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id: quizId, attemptId } = await params;

    try {
        const body = await req.json();
        const { questionId, selectedOptionIds, shortAnswerText } = body as {
            questionId: string;
            selectedOptionIds?: string[];
            shortAnswerText?: string;
        };
        if (!questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

        // Short answers are plain textarea input — stored as text (never HTML) and rendered as text.
        const plainAnswer = typeof shortAnswerText === "string" ? shortAnswerText.slice(0, 5000) : null;

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const attempt = await tx.quizAttempt.findFirst({
                where: { id: attemptId, courseId, quizId, studentUserId: user.id },
            });
            if (!attempt) return null;
            if (attempt.status !== "IN_PROGRESS") return "locked" as const;

            await tx.quizAnswer.upsert({
                where: { attemptId_questionId: { attemptId, questionId } },
                create: {
                    courseId,
                    attemptId,
                    questionId,
                    selectedOptionIds: Array.isArray(selectedOptionIds) ? selectedOptionIds : [],
                    shortAnswerText: plainAnswer,
                },
                update: {
                    selectedOptionIds: Array.isArray(selectedOptionIds) ? selectedOptionIds : [],
                    shortAnswerText: plainAnswer,
                    answeredAt: new Date(),
                },
            });
            return "ok" as const;
        });

        if (result === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (result === "locked") return NextResponse.json({ error: "Attempt already submitted" }, { status: 409 });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Quiz Answer POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
