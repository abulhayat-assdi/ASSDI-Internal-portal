import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST — records one tab-switch / window-blur event during an attempt.
 * Logged and shown to the teacher only (confirmed choice) — never auto-submits.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const { id: quizId, attemptId } = await params;

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const attempt = await tx.quizAttempt.findFirst({
            where: { id: attemptId, courseId, quizId, studentUserId: user.id, status: "IN_PROGRESS" },
        });
        if (!attempt) return null;
        return tx.quizAttempt.update({
            where: { id: attemptId },
            data: { tabSwitchCount: { increment: 1 } },
            select: { tabSwitchCount: true },
        });
    });

    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result);
}
