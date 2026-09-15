export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission } from "@/lib/auth";
import { validateThresholds } from "@/lib/typing-exam/scoring";
import { pickBankPassage, EXAM_TEXT_CATEGORIES, type ExamTextLanguage } from "@/lib/typing-exam/content";
import type { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/typing-exam/[id] — single exam
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !hasRequiredPermission(user, "typing_exam")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;
  const { id } = await params;

  const exam = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    tx.typingExam.findFirst({ where: { id, courseId } })
  );

  if (!exam) return NextResponse.json({ error: "Exam পাওয়া যায়নি" }, { status: 404 });
  return NextResponse.json(exam);
}

// PATCH /api/typing-exam/[id] — partial update
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !hasRequiredPermission(user, "typing_exam")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));

  const existing = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    tx.typingExam.findFirst({ where: { id, courseId } })
  );
  if (!existing) return NextResponse.json({ error: "Exam পাওয়া যায়নি" }, { status: 404 });

  const data: Prisma.TypingExamUpdateInput = {};

  if (typeof body.title === "string") {
    if (!body.title.trim()) return NextResponse.json({ error: "শিরোনাম আবশ্যক" }, { status: 400 });
    data.title = body.title.trim();
  }
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.scheduleStart !== undefined) {
    data.scheduleStart = body.scheduleStart ? new Date(body.scheduleStart) : null;
  }
  if (body.scheduleEnd !== undefined) {
    data.scheduleEnd = body.scheduleEnd ? new Date(body.scheduleEnd) : null;
  }
  if (body.durationSeconds !== undefined) {
    const n = Number(body.durationSeconds);
    if (Number.isNaN(n) || n <= 0) return NextResponse.json({ error: "সময়সীমা সঠিক নয়" }, { status: 400 });
    data.durationSeconds = n;
  }
  if (existing.accessType === "INTERNAL" && body.batchNames !== undefined) {
    if (!Array.isArray(body.batchNames) || body.batchNames.length === 0) {
      return NextResponse.json({ error: "অন্তত একটি ব্যাচ নির্বাচন করুন" }, { status: 400 });
    }
    data.batchNames = body.batchNames;
  }

  // Thresholds — re-validate against the merged (existing + incoming) values
  const thresholdKeys = ["passWpm", "passAccuracy", "failWpm", "failAccuracy"] as const;
  const touchesThresholds = thresholdKeys.some((k) => body[k] !== undefined);
  if (touchesThresholds) {
    const merged = {
      passWpm: body.passWpm !== undefined ? Number(body.passWpm) : existing.passWpm,
      passAccuracy: body.passAccuracy !== undefined ? Number(body.passAccuracy) : existing.passAccuracy,
      failWpm: body.failWpm !== undefined ? Number(body.failWpm) : existing.failWpm,
      failAccuracy: body.failAccuracy !== undefined ? Number(body.failAccuracy) : existing.failAccuracy,
    };
    if (Object.values(merged).some((v) => Number.isNaN(v))) {
      return NextResponse.json({ error: "সবগুলো থ্রেশহোল্ড ভ্যালু সংখ্যা হতে হবে" }, { status: 400 });
    }
    const err = validateThresholds(merged);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    data.passWpm = merged.passWpm;
    data.passAccuracy = merged.passAccuracy;
    data.failWpm = merged.failWpm;
    data.failAccuracy = merged.failAccuracy;
  }

  // Text source / language / category / custom text — recompute examText if any of these change
  const touchesText =
    body.textSource !== undefined ||
    body.customText !== undefined ||
    body.textLanguage !== undefined ||
    body.textCategory !== undefined;
  if (touchesText) {
    const resolvedTextSource = (body.textSource ?? existing.textSource) === "BANK" ? "BANK" : "CUSTOM";
    const resolvedLanguage: ExamTextLanguage =
      (body.textLanguage ?? existing.textLanguage) === "bn" ? "bn" : "en";
    data.textSource = resolvedTextSource;
    data.textLanguage = resolvedLanguage;
    if (resolvedTextSource === "CUSTOM") {
      const customText = body.customText !== undefined ? body.customText : existing.examText;
      if (!customText || typeof customText !== "string" || !customText.trim()) {
        return NextResponse.json({ error: "Custom টেক্সট আবশ্যক" }, { status: 400 });
      }
      data.examText = customText;
      data.textCategory = null;
    } else {
      const rawCategory = body.textCategory !== undefined ? body.textCategory : existing.textCategory;
      const resolvedCategory =
        typeof rawCategory === "string" && EXAM_TEXT_CATEGORIES.includes(rawCategory)
          ? rawCategory
          : null;
      data.textCategory = resolvedCategory;
      data.examText = pickBankPassage(resolvedLanguage, resolvedCategory ?? undefined);
    }
  }

  // Retry password — optional on edit (blank/omitted = keep existing password).
  // Applies to both INTERNAL and PUBLIC exams. accessType itself is never
  // changed after creation (publicSlug stays fixed).
  if (typeof body.retryPassword === "string" && body.retryPassword.trim()) {
    data.retryPasswordHash = await bcrypt.hash(body.retryPassword, 10);
  }

  const updated = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    tx.typingExam.update({ where: { id }, data })
  );

  return NextResponse.json(updated);
}

// DELETE /api/typing-exam/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !hasRequiredPermission(user, "typing_exam")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;
  const { id } = await params;

  const existing = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    tx.typingExam.findFirst({ where: { id, courseId } })
  );
  if (!existing) return NextResponse.json({ error: "Exam পাওয়া যায়নি" }, { status: 404 });

  await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    tx.typingExam.delete({ where: { id } })
  );

  return NextResponse.json({ success: true });
}
