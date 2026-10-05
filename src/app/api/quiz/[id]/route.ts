import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { logQuizActivity } from "@/lib/quizLog";
import { sanitizeRichText } from "@/lib/sanitizeHtml";
import { notifyStudentsOfQuiz } from "@/lib/notifications";
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

async function loadOwnedQuiz(courseId: string, id: string) {
    return withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.quiz.findFirst({
            where: { id, courseId },
            include: {
                questions: { orderBy: { order: "asc" } },
                _count: { select: { attempts: true } },
            },
        })
    );
}

/** GET /api/quiz/[id] — full quiz + questions (with answer keys) for the teacher/admin builder. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const quiz = await loadOwnedQuiz(user.courseId, id);
    if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(quiz);
}

/**
 * PATCH /api/quiz/[id] — update settings, publish/unpublish, and/or replace
 * the question set. Full question-set replacement is only allowed while the
 * quiz has zero attempts — once students have started taking it, its
 * question set is "resolved and fixed" (same principle as TypingExam.examText)
 * and new questions must go through POST /api/quiz/[id]/questions instead.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    try {
        const body = await req.json();
        const { questions, ...settings } = body as { questions?: IncomingQuestion[]; [key: string]: unknown };

        const existing = await loadOwnedQuiz(courseId, id);
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (Array.isArray(questions) && existing._count.attempts > 0) {
            return NextResponse.json(
                { error: "এই কুইজে ইতিমধ্যে অ্যাটেম্পট জমা পড়েছে — প্রশ্ন সেট এখন আর সম্পূর্ণ বদলানো যাবে না। নতুন প্রশ্ন যোগ করতে বাল্ক-অ্যাড ব্যবহার করুন।" },
                { status: 409 }
            );
        }

        const data: Record<string, unknown> = {};
        for (const key of [
            "title", "batchNames", "optionLabelStyle", "shuffleQuestions", "shuffleOptions",
            "allowBacktrack", "durationSeconds", "maxAttempts", "practiceModeAllowed",
            "negativeMarkPerWrong", "passPercentage", "resultReleaseMode", "isActive",
        ]) {
            if (key in settings) data[key] = settings[key];
        }
        if ("descriptionHtml" in settings) data.descriptionHtml = sanitizeRichText(String(settings.descriptionHtml || ""));
        for (const key of ["resultReleaseAt", "scheduleStart", "scheduleEnd"]) {
            if (key in settings) data[key] = settings[key] ? new Date(settings[key] as string) : null;
        }

        const wasActive = existing.isActive;

        const updated = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            if (Array.isArray(questions)) {
                await tx.quizQuestion.deleteMany({ where: { quizId: id, courseId } });
            }
            const result = await tx.quiz.update({
                where: { id },
                data: {
                    ...data,
                    ...(Array.isArray(questions)
                        ? { questions: { create: questions.map((q, i) => sanitizeQuestion(q, i, courseId)) } }
                        : {}),
                },
                include: { questions: { orderBy: { order: "asc" } }, _count: { select: { attempts: true } } },
            });

            await logQuizActivity(tx, user, {
                action: data.isActive === true && !wasActive ? "QUIZ_PUBLISHED"
                    : data.isActive === false && wasActive ? "QUIZ_UNPUBLISHED"
                    : "QUIZ_UPDATED",
                targetType: "quiz",
                targetId: id,
                description: `${user.displayName} updated quiz "${result.title}"`,
            });

            return result;
        });

        // Newly published (draft -> active): let the batch know.
        if (data.isActive === true && !wasActive) {
            const batchNames = updated.batchNames as string[];
            notifyStudentsOfQuiz({
                courseId,
                title: updated.title,
                batchName: batchNames.length === 1 ? batchNames[0] : "all",
                scheduleEnd: updated.scheduleEnd ? updated.scheduleEnd.toISOString() : null,
                teacherName: updated.createdByName,
            });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("[Quiz PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/quiz/[id] */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    try {
        const existing = await loadOwnedQuiz(courseId, id);
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            await tx.quiz.delete({ where: { id } });
            await logQuizActivity(tx, user, {
                action: "QUIZ_DELETED",
                targetType: "quiz",
                targetId: id,
                description: `${user.displayName} deleted quiz "${existing.title}"`,
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Quiz DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
