import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { scoreAttempt, gradeAttempt } from "@/lib/typing-exam/scoring";
import { loadVisibleExam } from "@/lib/typing-exam/visibility";
import { checkRetryPassword } from "@/lib/typing-exam/retryGate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/student/typing-exam/[id]/attempt
 * Authoritative write path: re-validates visibility + attempts-remaining
 * (never trusts that GET was called first), scores the submission
 * server-side, and records the attempt.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const studentBatchName = user.studentBatchName || "";
    const { id } = await params;

    let body: { typedText?: unknown; elapsedSeconds?: unknown; retryPassword?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { typedText, elapsedSeconds } = body;
    const retryPassword = typeof body.retryPassword === "string" ? body.retryPassword : undefined;
    if (typeof typedText !== "string" || typeof elapsedSeconds !== "number") {
        return NextResponse.json({ error: "typedText and elapsedSeconds are required" }, { status: 400 });
    }

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const result = await loadVisibleExam(tx, courseId, id, studentBatchName);
            if ("error" in result) {
                return NextResponse.json({ error: result.error }, { status: result.status });
            }
            const { exam } = result;

            const gate = await checkRetryPassword(
                tx,
                courseId,
                exam.id,
                { studentUserId: user.id },
                exam.retryPasswordHash,
                retryPassword
            );
            if (!gate.ok) {
                return NextResponse.json(gate.body, { status: gate.status });
            }
            const attemptsUsed = gate.attemptsUsed;

            // Defend against a tampered client-side timer.
            const clampedElapsed = Math.max(1, Math.min(elapsedSeconds, exam.durationSeconds));
            // Defend against an over-long submission inflating totalChars/accuracy.
            const clampedTypedText = typedText.slice(0, exam.examText.length);

            const { correctChars, totalChars, wpm, accuracy } = scoreAttempt({
                originalText: exam.examText,
                typedText: clampedTypedText,
                elapsedSeconds: clampedElapsed,
            });

            const gradeResult = gradeAttempt(wpm, accuracy, {
                passWpm: exam.passWpm,
                passAccuracy: exam.passAccuracy,
                failWpm: exam.failWpm,
                failAccuracy: exam.failAccuracy,
            });

            await tx.typingExamAttempt.create({
                data: {
                    courseId,
                    examId: exam.id,
                    takerType: "STUDENT",
                    studentUserId: user.id,
                    studentName: user.displayName || "",
                    studentRoll: user.studentRoll || "",
                    studentBatchName,
                    attemptNumber: attemptsUsed + 1,
                    wpm,
                    accuracy,
                    correctChars,
                    totalChars,
                    durationTakenSeconds: clampedElapsed,
                    result: gradeResult,
                },
            });

            return NextResponse.json({ wpm, accuracy, result: gradeResult });
        });
    } catch (error) {
        console.error("[Student TypingExam Attempt POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
