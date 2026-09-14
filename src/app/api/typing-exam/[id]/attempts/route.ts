export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/typing-exam/[id]/attempts — full attempts list for one exam (results table)
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !hasRequiredPermission(user, "typing_exam")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;
  const { id: examId } = await params;

  const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
    const exam = await tx.typingExam.findFirst({ where: { id: examId, courseId } });
    if (!exam) return null;

    const attempts = await tx.typingExamAttempt.findMany({
      where: { examId, courseId },
      orderBy: { submittedAt: "desc" },
    });

    return attempts.map((a) => ({
      id: a.id,
      takerType: a.takerType,
      name: a.takerType === "STUDENT" ? a.studentName : a.publicName,
      roll: a.takerType === "STUDENT" ? a.studentRoll : a.publicRoll,
      batchName: a.takerType === "STUDENT" ? a.studentBatchName : null,
      phone: a.takerType === "PUBLIC" ? a.publicPhone : null,
      attemptNumber: a.attemptNumber,
      wpm: a.wpm,
      accuracy: a.accuracy,
      correctChars: a.correctChars,
      totalChars: a.totalChars,
      durationTakenSeconds: a.durationTakenSeconds,
      result: a.result,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
    }));
  });

  if (result === null) return NextResponse.json({ error: "Exam পাওয়া যায়নি" }, { status: 404 });
  return NextResponse.json(result);
}
