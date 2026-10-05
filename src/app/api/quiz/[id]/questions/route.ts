import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { logQuizActivity } from "@/lib/quizLog";
import { sanitizeRichText } from "@/lib/sanitizeHtml";
import type { QuizOptionData } from "@/lib/quiz/grading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface IncomingQuestion {
    type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
    bodyHtml: string;
    marks?: number;
    explanationHtml?: string;
    tag?: string;
    difficulty?: string;
    options?: QuizOptionData[];
    sourceBankItemId?: string;
}

/**
 * POST /api/quiz/[id]/questions — append questions to an existing quiz.
 * Used by both the manual "add many" flow and the CSV/Excel bulk-import flow
 * (the client parses the file with the `xlsx` package and posts the resulting
 * rows here, same shape either way, after a preview step).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    try {
        const body = await req.json();
        const questions: IncomingQuestion[] = body.questions;
        if (!Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: "questions array required" }, { status: 400 });
        }

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const quiz = await tx.quiz.findFirst({ where: { id, courseId }, select: { id: true, title: true } });
            if (!quiz) return null;

            const maxOrder = await tx.quizQuestion.aggregate({
                where: { quizId: id, courseId },
                _max: { order: true },
            });
            let nextOrder = (maxOrder._max.order ?? -1) + 1;

            const created = await tx.quizQuestion.createMany({
                data: questions.map((q) => ({
                    courseId,
                    quizId: id,
                    order: nextOrder++,
                    type: q.type,
                    bodyHtml: sanitizeRichText(q.bodyHtml || ""),
                    marks: typeof q.marks === "number" && q.marks > 0 ? q.marks : 1,
                    explanationHtml: sanitizeRichText(q.explanationHtml || ""),
                    tag: q.tag || null,
                    difficulty: q.difficulty || null,
                    options: (q.options || []).map((o) => ({
                        id: o.id,
                        textHtml: sanitizeRichText(o.textHtml || ""),
                        isCorrect: Boolean(o.isCorrect),
                    })),
                    sourceBankItemId: q.sourceBankItemId || null,
                })),
            });

            await logQuizActivity(tx, user, {
                action: "QUIZ_QUESTIONS_ADDED",
                targetType: "quiz",
                targetId: id,
                description: `${user.displayName} added ${created.count} question(s) to quiz "${quiz.title}"`,
            });

            return created;
        });

        if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ success: true, count: result.count }, { status: 201 });
    } catch (error) {
        console.error("[Quiz Questions POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
