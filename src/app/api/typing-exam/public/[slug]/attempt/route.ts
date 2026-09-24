export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { normalizePhone } from "@/lib/typing-exam/identity";
import { scoreAttempt, gradeAttempt } from "@/lib/typing-exam/scoring";
import { checkRetryPassword } from "@/lib/typing-exam/retryGate";
import { HOUR, rateLimitByIp } from "@/lib/rateLimit";

type RouteParams = { params: Promise<{ slug: string }> };

// POST /api/typing-exam/public/[slug]/attempt
// The authoritative write path. Re-validates the exam and the
// duplicate-attempt/password gate itself (never trusts that /check ran
// first), then scores the submission server-side and persists it.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const limited = rateLimitByIp(req, "typing-exam-attempt", 30, HOUR);
  if (limited) return limited;

  const { slug } = await params;

  const exam = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.typingExam.findUnique({ where: { publicSlug: slug } })
  );
  if (!exam) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (exam.accessType !== "PUBLIC") {
    return NextResponse.json({ error: "not_public" }, { status: 403 });
  }
  if (!exam.isActive) {
    return NextResponse.json({ error: "not_active" }, { status: 403 });
  }
  const now = new Date();
  if (exam.scheduleStart && now < exam.scheduleStart) {
    return NextResponse.json({ error: "not_started" }, { status: 403 });
  }
  if (exam.scheduleEnd && now > exam.scheduleEnd) {
    return NextResponse.json({ error: "ended" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, roll, phone, password, typedText, elapsedSeconds } = body as {
    name?: string;
    roll?: string;
    phone?: string;
    password?: string;
    typedText?: string;
    elapsedSeconds?: number;
  };
  if (!name?.trim() || !roll?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (typeof typedText !== "string" || typeof elapsedSeconds !== "number" || !Number.isFinite(elapsedSeconds)) {
    return NextResponse.json({ error: "invalid_submission" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone);
  const courseId = exam.courseId;

  const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
    const gate = await checkRetryPassword(
      tx,
      courseId,
      exam.id,
      { publicPhone: normalizedPhone },
      exam.retryPasswordHash,
      password
    );
    if (!gate.ok) {
      return { status: gate.status, body: gate.body };
    }
    const priorAttempts = gate.attemptsUsed;

    const clampedElapsed = Math.min(Math.max(elapsedSeconds, 0), exam.durationSeconds);
    // Defend against an over-long submission inflating totalChars/accuracy.
    const clampedTypedText = typedText.slice(0, exam.examText.length);
    const score = scoreAttempt({
      originalText: exam.examText,
      typedText: clampedTypedText,
      elapsedSeconds: clampedElapsed,
    });
    const gradeResult = gradeAttempt(score.wpm, score.accuracy, {
      passWpm: exam.passWpm,
      passAccuracy: exam.passAccuracy,
      failWpm: exam.failWpm,
      failAccuracy: exam.failAccuracy,
    });

    await tx.typingExamAttempt.create({
      data: {
        courseId,
        examId: exam.id,
        takerType: "PUBLIC",
        publicName: name.trim(),
        publicRoll: roll.trim(),
        publicPhone: normalizedPhone,
        attemptNumber: priorAttempts + 1,
        wpm: score.wpm,
        accuracy: score.accuracy,
        correctChars: score.correctChars,
        totalChars: score.totalChars,
        durationTakenSeconds: clampedElapsed,
        result: gradeResult,
      },
    });

    return {
      status: 200 as const,
      body: { wpm: score.wpm, accuracy: score.accuracy, result: gradeResult },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
}
