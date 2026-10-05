import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET — the student's batch leaderboard for a self-paced quiz: each student's
 * best finished attempt, top 10 plus the caller's own rank. Only available
 * once results are visible, so it can't leak scores the teacher is holding back.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id: quizId } = await params;
    const batchName = user.studentBatchName || "";

    const data = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const quiz = await tx.quiz.findFirst({ where: { id: quizId, courseId } });
        if (!quiz) return { error: "not-found" as const };
        const batchNames = Array.isArray(quiz.batchNames) ? (quiz.batchNames as unknown[]) : [];
        if (!batchNames.some((b) => b === batchName || b === "all")) return { error: "not-found" as const };
        if (!quiz.showLeaderboard) return { error: "disabled" as const };

        const released =
            quiz.resultReleaseMode === "IMMEDIATE" ||
            Boolean(quiz.resultsReleasedAt) ||
            (quiz.resultReleaseAt != null && new Date() >= quiz.resultReleaseAt);
        if (!released) return { error: "not-released" as const };

        const attempts = await tx.quizAttempt.findMany({
            where: { courseId, quizId, isPractice: false, status: { in: ["SUBMITTED", "GRADED"] }, studentBatchName: batchName },
            select: { studentUserId: true, studentName: true, score: true, percentage: true, durationTakenSeconds: true },
        });

        const best = new Map<string, (typeof attempts)[number]>();
        for (const a of attempts) {
            const cur = best.get(a.studentUserId);
            const better = !cur || a.score > cur.score || (a.score === cur.score && (a.durationTakenSeconds ?? Infinity) < (cur.durationTakenSeconds ?? Infinity));
            if (better) best.set(a.studentUserId, a);
        }
        const ranked = [...best.values()]
            .sort((a, b) => b.score - a.score || (a.durationTakenSeconds ?? Infinity) - (b.durationTakenSeconds ?? Infinity))
            .map((a, i) => ({
                rank: i + 1,
                name: quiz.leaderboardShowNames || a.studentUserId === user.id ? a.studentName : `Student ${i + 1}`,
                score: Math.round(a.score * 10) / 10,
                percentage: Math.round(a.percentage * 10) / 10,
                durationTakenSeconds: a.durationTakenSeconds,
                isMe: a.studentUserId === user.id,
            }));

        return { error: null, total: ranked.length, top: ranked.slice(0, 10), me: ranked.find((r) => r.isMe) ?? null };
    });

    if (data.error) {
        const status = data.error === "not-found" ? 404 : 403;
        return NextResponse.json({ error: data.error }, { status });
    }
    return NextResponse.json(data);
}
