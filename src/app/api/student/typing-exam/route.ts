import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/student/typing-exam
 * Lists INTERNAL exams currently live for the caller's own batch, along with
 * their own attempt history against each, so the UI can show
 * start / already-attempted / attempts-exhausted state without leaking the
 * exam passage or grading thresholds.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const studentBatchName = user.studentBatchName || "";

    try {
        const now = new Date();

        const exams = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const candidates = await tx.typingExam.findMany({
                where: {
                    courseId,
                    accessType: "INTERNAL",
                    isActive: true,
                },
                orderBy: { createdAt: "desc" },
            });

            const visible = candidates.filter((exam) => {
                const batchNames = Array.isArray(exam.batchNames) ? (exam.batchNames as unknown[]) : [];
                if (!batchNames.some((b) => typeof b === "string" && b === studentBatchName)) return false;
                if (exam.scheduleStart && now < exam.scheduleStart) return false;
                if (exam.scheduleEnd && now > exam.scheduleEnd) return false;
                return true;
            });

            if (visible.length === 0) return [];

            const attempts = await tx.typingExamAttempt.findMany({
                where: {
                    courseId,
                    examId: { in: visible.map((e) => e.id) },
                    takerType: "STUDENT",
                    studentUserId: user.id,
                },
                orderBy: { submittedAt: "desc" },
            });

            return visible.map((exam) => {
                const examAttempts = attempts.filter((a) => a.examId === exam.id);
                const attemptsUsed = examAttempts.length;
                const latest = examAttempts[0];
                return {
                    id: exam.id,
                    title: exam.title,
                    description: exam.description,
                    durationSeconds: exam.durationSeconds,
                    maxAttempts: exam.maxAttempts,
                    attemptsUsed,
                    canAttempt: attemptsUsed < exam.maxAttempts,
                    lastResult: latest
                        ? { wpm: latest.wpm, accuracy: latest.accuracy, result: latest.result }
                        : undefined,
                };
            });
        });

        return NextResponse.json(exams);
    } catch (error) {
        console.error("[Student TypingExam GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
