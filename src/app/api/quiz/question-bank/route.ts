import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { sanitizeRichText } from "@/lib/sanitizeHtml";
import type { QuizOptionData } from "@/lib/quiz/grading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/quiz/question-bank?tag=...&difficulty=...
 * Course-wide — any teacher/admin in the course can reuse any bank item (like Resources).
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const tag = searchParams.get("tag");
    const difficulty = searchParams.get("difficulty");

    const items = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.quizQuestionBankItem.findMany({
            where: {
                courseId,
                ...(tag ? { tag } : {}),
                ...(difficulty ? { difficulty } : {}),
            },
            orderBy: { createdAt: "desc" },
        })
    );

    return NextResponse.json(items);
}

interface IncomingBankItem {
    type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
    bodyHtml: string;
    marks?: number;
    explanationHtml?: string;
    tag?: string;
    difficulty?: string;
    options?: QuizOptionData[];
}

/** POST /api/quiz/question-bank — save one question to the reusable bank. */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body: IncomingBankItem = await req.json();
        if (!body.bodyHtml || !body.type) {
            return NextResponse.json({ error: "type and bodyHtml required" }, { status: 400 });
        }

        const item = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.quizQuestionBankItem.create({
                data: {
                    courseId,
                    type: body.type,
                    bodyHtml: sanitizeRichText(body.bodyHtml),
                    marks: typeof body.marks === "number" && body.marks > 0 ? body.marks : 1,
                    explanationHtml: sanitizeRichText(body.explanationHtml || ""),
                    tag: body.tag || null,
                    difficulty: body.difficulty || null,
                    options: (body.options || []).map((o) => ({
                        id: o.id,
                        textHtml: sanitizeRichText(o.textHtml || ""),
                        isCorrect: Boolean(o.isCorrect),
                    })),
                    createdByUid: user.id,
                    createdByName: user.displayName,
                },
            })
        );

        return NextResponse.json(item, { status: 201 });
    } catch (error) {
        console.error("[QuestionBank POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
