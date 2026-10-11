import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadVisibleExam } from "@/lib/typing-exam/visibility";
import { retryPasswordMatches, STUDENT_PASSWORD_FAILURES_PER_HOUR, studentPasswordLimitKey } from "@/lib/typing-exam/retryGate";
import { HOUR, isOverLimit, recordAttempt } from "@/lib/rateLimit";
import { parseClientSnapshot, readJsonBody } from "@/lib/typing-exam/session";
import { finalizeSession, findOwnedSession, resultBody, submitWithoutSession, type RecordedResult } from "@/lib/typing-exam/sessionStore";
import { logActivity } from "@/lib/activityLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/student/typing-exam/[id]/attempt
 * Authoritative write path. With a sessionId (normal flow) it finalizes that
 * run — idempotently, and even if the exam closed after the run started.
 * Without one (the /start call failed, or a tab opened before this engine)
 * it re-validates visibility and the retry-password gate itself. Either way
 * the score is computed server-side from the submitted snapshot.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const studentBatchName = user.studentBatchName || "";
    const { id } = await params;
    const body = await readJsonBody(req);
    const hasSession = typeof body.sessionId === "string" && body.sessionId !== "";

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            let recorded: RecordedResult | null;
            let examTitle: string;

            if (hasSession) {
                const exam = await tx.typingExam.findUnique({ where: { id, courseId } });
                if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });
                const snapshot = parseClientSnapshot(body, exam.examText);
                if (!snapshot) {
                    return NextResponse.json({ error: "typedText and elapsedMs are required" }, { status: 400 });
                }
                const session = await findOwnedSession(tx, exam.id, body.sessionId, { studentUserId: user.id });
                if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
                recorded = await finalizeSession(tx, exam, session.id, snapshot);
                if (!recorded) return NextResponse.json({ error: "session_closed" }, { status: 409 });
                examTitle = exam.title;
            } else {
                const limitKey = studentPasswordLimitKey(user.id);
                if (isOverLimit(limitKey, STUDENT_PASSWORD_FAILURES_PER_HOUR)) {
                    return NextResponse.json({ error: "অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" }, { status: 429 });
                }
                const visible = await loadVisibleExam(tx, courseId, id, studentBatchName);
                if ("error" in visible) {
                    return NextResponse.json({ error: visible.error }, { status: visible.status });
                }
                const { exam } = visible;
                const snapshot = parseClientSnapshot(body, exam.examText);
                if (!snapshot) {
                    return NextResponse.json({ error: "typedText and elapsedMs are required" }, { status: 400 });
                }
                const res = await submitWithoutSession(
                    tx,
                    exam,
                    {
                        type: "STUDENT",
                        userId: user.id,
                        name: user.displayName || "",
                        roll: user.studentRoll || "",
                        batchName: studentBatchName,
                    },
                    snapshot,
                    () => retryPasswordMatches(body.retryPassword, exam.retryPasswordHash)
                );
                if (!res.ok) {
                    recordAttempt(limitKey, HOUR);
                    return NextResponse.json({ needsPassword: true }, { status: 401 });
                }
                recorded = res.recorded;
                examTitle = exam.title;
            }

            if (recorded.fresh) await logActivity(tx, {
                courseId,
                actorUid: user.id,
                actorRole: "STUDENT",
                actionType: "TYPING_EXAM_ATTEMPTED",
                targetType: "typing_exam_attempt",
                targetId: recorded.attemptId,
                description: `${user.displayName || user.id} "${examTitle}" এক্সামে অংশ নিয়েছে — ${recorded.wpm} WPM, ${recorded.result}`,
            });

            return NextResponse.json(resultBody(recorded));
        });
    } catch (error) {
        console.error("[Student TypingExam Attempt POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
