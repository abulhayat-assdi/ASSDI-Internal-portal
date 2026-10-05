import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { logQuizActivity } from "@/lib/quizLog";
import { notifyStudentsOfQuizResults } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/quiz/[id]/release-results — manually reveal results early (HELD mode). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { id } = await params;

    const quiz = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const existing = await tx.quiz.findFirst({ where: { id, courseId } });
        if (!existing) return null;

        const updated = await tx.quiz.update({
            where: { id },
            data: { resultsReleasedAt: new Date() },
        });

        await logQuizActivity(tx, user, {
            action: "QUIZ_RESULTS_RELEASED",
            targetType: "quiz",
            targetId: id,
            description: `${user.displayName} released results for quiz "${updated.title}"`,
        });

        return updated;
    });

    if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const batchNames = quiz.batchNames as string[];
    notifyStudentsOfQuizResults({
        courseId,
        batchName: batchNames.length === 1 ? batchNames[0] : "all",
        quizTitle: quiz.title,
    });

    return NextResponse.json(quiz);
}
