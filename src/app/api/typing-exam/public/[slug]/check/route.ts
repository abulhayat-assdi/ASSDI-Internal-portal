export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { normalizePhone } from "@/lib/typing-exam/identity";
import { checkRetryPassword } from "@/lib/typing-exam/retryGate";
import { HOUR, rateLimitByIp } from "@/lib/rateLimit";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * Resolves a public typing exam by its globally-unique slug (RLS bypass,
 * mirrors the student-form/[slug] precedent), then validates it is actually
 * open to the public right now. Returns a discriminated result so both GET
 * (metadata for the identity page) and POST (identity+password gate) share
 * one source of truth for "is this exam takeable".
 */
async function resolveOpenExam(slug: string) {
  const exam = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.typingExam.findUnique({ where: { publicSlug: slug } })
  );
  if (!exam) return { ok: false as const, status: 404, error: "not_found" };
  if (exam.accessType !== "PUBLIC") return { ok: false as const, status: 403, error: "not_public" };
  if (!exam.isActive) return { ok: false as const, status: 403, error: "not_active" };
  const now = new Date();
  if (exam.scheduleStart && now < exam.scheduleStart) {
    return { ok: false as const, status: 403, error: "not_started" };
  }
  if (exam.scheduleEnd && now > exam.scheduleEnd) {
    return { ok: false as const, status: 403, error: "ended" };
  }
  return { ok: true as const, exam };
}

// GET /api/typing-exam/public/[slug]/check
// Unauthenticated metadata lookup so the identity page can show the exam's
// title/description (and the right "not found" / "not active" message)
// before the visitor has typed anything.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const resolved = await resolveOpenExam(slug);
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
  const limited = rateLimitByIp(req, "typing-exam-check", 30, HOUR);
  if (limited) return limited;

  const { slug } = await params;
  const resolved = await resolveOpenExam(slug);
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
    examText: exam.examText,
    durationSeconds: exam.durationSeconds,
    title: exam.title,
  });
}
