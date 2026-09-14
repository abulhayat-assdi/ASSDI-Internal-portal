import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadVisibleExam } from "@/lib/typing-exam/visibility";
import { checkRetryPassword } from "@/lib/typing-exam/retryGate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/student/typing-exam/[id]/retry-check
 * Lightweight pre-check for the inline "Try Again" password prompt, so the
 * student gets instant feedback before the runner is re-mounted. This is
 * NOT the authoritative gate — the attempt POST independently re-verifies
 * the password itself and must never trust that this call succeeded.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;
    const studentBatchName = user.studentBatchName || "";
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : undefined;

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
                password
            );
            if (!gate.ok) {
                return NextResponse.json(gate.body, { status: gate.status });
            }

            return NextResponse.json({ ok: true });
        });
    } catch (error) {
        console.error("[Student TypingExam Retry-Check POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
