import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadVisibleExam } from "@/lib/typing-exam/visibility";
import { retryPasswordMatches, STUDENT_PASSWORD_FAILURES_PER_HOUR, studentPasswordLimitKey } from "@/lib/typing-exam/retryGate";
import { HOUR, isOverLimit, recordAttempt } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/typing-exam/session";
import { startSession } from "@/lib/typing-exam/sessionStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/student/typing-exam/[id]/start
 * Opens a server-side session for one run, called as the 3-2-1 countdown
 * begins. Re-runs visibility and the retry-password gate itself.
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
    const limitKey = studentPasswordLimitKey(user.id);
    if (isOverLimit(limitKey, STUDENT_PASSWORD_FAILURES_PER_HOUR)) {
        return NextResponse.json({ error: "অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" }, { status: 429 });
    }

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const visible = await loadVisibleExam(tx, courseId, id, studentBatchName);
            if ("error" in visible) {
                return NextResponse.json({ error: visible.error }, { status: visible.status });
            }
            const { exam } = visible;

            const started = await startSession(
                tx,
                exam,
                {
                    type: "STUDENT",
                    userId: user.id,
                    name: user.displayName || "",
                    roll: user.studentRoll || "",
                    batchName: studentBatchName,
                },
                () => retryPasswordMatches(body.retryPassword, exam.retryPasswordHash)
            );
            if (!started.ok) {
                recordAttempt(limitKey, HOUR);
                return NextResponse.json({ needsPassword: true }, { status: 401 });
            }
            return NextResponse.json({ sessionId: started.sessionId });
        });
    } catch (error) {
        console.error("[Student TypingExam Start POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
