import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { parseClientSnapshot, readJsonBody } from "@/lib/typing-exam/session";
import { findOwnedSession, saveProgress } from "@/lib/typing-exam/sessionStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/student/typing-exam/[id]/progress
 * Autosave for an in-flight run (every few seconds, and via sendBeacon when
 * the tab is hidden or closed). If the student never submits, this is what
 * their attempt is graded from. Deliberately skips the visibility check —
 * a run already started is finished even if the exam closes meanwhile.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id } = await params;
    const body = await readJsonBody(req);

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const exam = await tx.typingExam.findUnique({ where: { id, courseId } });
            if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });

            const snapshot = parseClientSnapshot(body, exam.examText);
            if (!snapshot) return NextResponse.json({ error: "invalid_submission" }, { status: 400 });

            const session = await findOwnedSession(tx, exam.id, body.sessionId, { studentUserId: user.id });
            if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

            const status = await saveProgress(tx, exam, session, snapshot);
            return NextResponse.json({ status });
        });
    } catch (error) {
        console.error("[Student TypingExam Progress POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
