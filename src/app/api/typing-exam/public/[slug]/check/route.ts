export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { normalizePhone } from "@/lib/typing-exam/identity";
import { checkRetryPassword } from "@/lib/typing-exam/retryGate";
import { resolvePublicExam } from "@/lib/typing-exam/publicExam";
import { cleanExamText } from "@/lib/typing-exam/examText";
import { HOUR, limitFromEnv, rateLimitByIp } from "@/lib/rateLimit";

type RouteParams = { params: Promise<{ slug: string }> };

// GET /api/typing-exam/public/[slug]/check
// Unauthenticated metadata lookup so the identity page can show the exam's
// title/description (and the right "not found" / "not active" message)
// before the visitor has typed anything.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const resolved = await resolvePublicExam(slug, { requireOpen: true });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { exam } = resolved;
  return NextResponse.json({
    title: exam.title,
    description: exam.description,
    durationSeconds: exam.durationSeconds,
  });
}

// POST /api/typing-exam/public/[slug]/check
// Identity + duplicate-attempt/password gate. On success returns everything
// the page needs to hand off to <ExamRunner>.
export async function POST(req: NextRequest, { params }: RouteParams) {
  // This endpoint checks the exam's retry password, so it is a credential
  // oracle — without a cap the password is trivially brute-forceable.
  // An exam is taken by a full class at once, all behind one address.
  const limited = rateLimitByIp(req, "typing-exam-check", limitFromEnv("EXAM_CHECK", 300), HOUR);
  if (limited) return limited;

  const { slug } = await params;
  const resolved = await resolvePublicExam(slug, { requireOpen: true });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { exam } = resolved;

  const body = await req.json().catch(() => ({}));
  const { name, roll, phone, password } = body as {
    name?: string;
    roll?: string;
    phone?: string;
    password?: string;
  };
  if (!name?.trim() || !roll?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone);
  const courseId = exam.courseId;

  const gate = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    checkRetryPassword(tx, courseId, exam.id, { publicPhone: normalizedPhone }, exam.retryPasswordHash, password)
  );
  if (!gate.ok) {
    return NextResponse.json(gate.body, { status: gate.status });
  }

  return NextResponse.json({
    examId: exam.id,
    examText: cleanExamText(exam.examText),
    durationSeconds: exam.durationSeconds,
    title: exam.title,
  });
}
