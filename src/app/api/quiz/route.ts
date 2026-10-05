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

function sanitizeQuestion(q: IncomingQuestion, order: number, courseId: string) {
    return {
        courseId,
        order,
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
    };
}

/** GET /api/quiz?teacherUid=... — own quizzes for a teacher, or all quizzes in the course for admin oversight */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const teacherUid = searchParams.get("teacherUid");

    const quizzes = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.quiz.findMany({
            where: {
                courseId,
                ...(teacherUid ? { createdByUid: teacherUid } : {}),
            },
            include: { _count: { select: { questions: true, attempts: true } } },
            orderBy: { createdAt: "desc" },
        })
    );

    return NextResponse.json(quizzes);
}

/** POST /api/quiz — create a quiz, optionally with an initial set of questions. */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const {
            title,
            descriptionHtml,
            batchNames,
            optionLabelStyle,
            shuffleQuestions,
            shuffleOptions,
            allowBacktrack,
            durationSeconds,
            maxAttempts,
            practiceModeAllowed,
            negativeMarkPerWrong,
            passPercentage,
            resultReleaseMode,
            resultReleaseAt,
            scheduleStart,
            scheduleEnd,
            questions,
        } = body;

        if (!title || !Array.isArray(batchNames) || batchNames.length === 0) {
            return NextResponse.json({ error: "title and batchNames are required" }, { status: 400 });
        }

        const quiz = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const created = await tx.quiz.create({
                data: {
                    courseId,
                    title,
                    descriptionHtml: sanitizeRichText(descriptionHtml || ""),
                    batchNames,
                    optionLabelStyle: optionLabelStyle || "LETTERS",
                    shuffleQuestions: shuffleQuestions ?? true,
                    shuffleOptions: shuffleOptions ?? true,
                    allowBacktrack: allowBacktrack ?? true,
                    durationSeconds: durationSeconds ?? null,
                    maxAttempts: maxAttempts ?? 1,
                    practiceModeAllowed: practiceModeAllowed ?? false,
                    negativeMarkPerWrong: negativeMarkPerWrong ?? 0,
                    passPercentage: passPercentage ?? null,
                    resultReleaseMode: resultReleaseMode || "IMMEDIATE",
                    resultReleaseAt: resultReleaseAt ? new Date(resultReleaseAt) : null,
                    scheduleStart: scheduleStart ? new Date(scheduleStart) : null,
                    scheduleEnd: scheduleEnd ? new Date(scheduleEnd) : null,
                    isActive: false, // draft until explicitly published (PATCH)
                    createdByUid: user.id,
                    createdByName: user.displayName,
                    createdByRole: user.role === "teacher" ? "teacher" : "admin",
                    questions: Array.isArray(questions) && questions.length > 0
                        ? { create: questions.map((q: IncomingQuestion, i: number) => sanitizeQuestion(q, i, courseId)) }
                        : undefined,
                },
                include: { _count: { select: { questions: true } } },
            });

            await logQuizActivity(tx, user, {
                action: "QUIZ_CREATED",
                targetType: "quiz",
                targetId: created.id,
                description: `${user.displayName} created quiz "${created.title}" for ${batchNames.includes("all") ? "all batches" : batchNames.join(", ")}`,
            });

            return created;
        });

        return NextResponse.json(quiz, { status: 201 });
    } catch (error) {
        console.error("[Quiz POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
