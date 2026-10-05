export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission } from "@/lib/auth";
import { gradeAttempt, validateThresholds } from "@/lib/typing-exam/scoring";
import { cleanExamText, parseDurationSeconds } from "@/lib/typing-exam/examText";
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
  let changesDuration = false;
  if (body.durationSeconds !== undefined) {
    const n = parseDurationSeconds(body.durationSeconds);
    if (n === null) {
      return NextResponse.json({ error: "সময়সীমা ১০ থেকে ৩৬০০ সেকেন্ডের মধ্যে একটি পূর্ণ সংখ্যা হতে হবে" }, { status: 400 });
    }
    changesDuration = n !== existing.durationSeconds;
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

  // Text source / language / category / custom text. The edit form always
  // sends all of these, so only a REAL change may touch the passage — before,
  // every save of a BANK exam (even a title edit) silently drew a new random
  // passage.
  const touchesText =
    body.textSource !== undefined ||
    body.customText !== undefined ||
    body.textLanguage !== undefined ||
    body.textCategory !== undefined;
  if (touchesText) {
    const resolvedTextSource = (body.textSource ?? existing.textSource) === "BANK" ? "BANK" : "CUSTOM";
    const resolvedLanguage: ExamTextLanguage =
      (body.textLanguage ?? existing.textLanguage) === "bn" ? "bn" : "en";
    const sourceChanged = resolvedTextSource !== existing.textSource;
    if (resolvedTextSource === "CUSTOM") {
      const customText = body.customText !== undefined ? body.customText : existing.examText;
      const cleaned = typeof customText === "string" ? cleanExamText(customText) : "";
      if (!cleaned) {
        return NextResponse.json({ error: "Custom টেক্সট আবশ্যক" }, { status: 400 });
      }
      if (sourceChanged || cleaned !== cleanExamText(existing.examText)) {
        data.textSource = resolvedTextSource;
        data.textLanguage = resolvedLanguage;
        data.textCategory = null;
        data.examText = cleaned;
      }
    } else {
      const rawCategory = body.textCategory !== undefined ? body.textCategory : existing.textCategory;
      const resolvedCategory =
        typeof rawCategory === "string" && EXAM_TEXT_CATEGORIES.includes(rawCategory)
          ? rawCategory
          : null;
      if (sourceChanged || resolvedLanguage !== existing.textLanguage || resolvedCategory !== existing.textCategory) {
        data.textSource = resolvedTextSource;
        data.textLanguage = resolvedLanguage;
        data.textCategory = resolvedCategory;
        data.examText = pickBankPassage(resolvedLanguage, resolvedCategory ?? undefined);
      }
    }
  }

  // Retry password — optional on edit (blank/omitted = keep existing password).
  // Applies to both INTERNAL and PUBLIC exams. accessType itself is never
  // changed after creation (publicSlug stays fixed).
  if (typeof body.retryPassword === "string" && body.retryPassword.trim()) {
    data.retryPasswordHash = await bcrypt.hash(body.retryPassword, 10);
  }

  const changesText = typeof data.examText === "string" && data.examText !== existing.examText;
  const thresholdsChanged =
    touchesThresholds &&
    (data.passWpm !== existing.passWpm ||
      data.passAccuracy !== existing.passAccuracy ||
      data.failWpm !== existing.failWpm ||
      data.failAccuracy !== existing.failAccuracy);

  const outcome = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
    // Once anyone has taken (or is taking) the exam, its passage and time are
    // frozen: results typed against different passages or durations are not
    // comparable, and a run in progress would be graded against text the
    // taker never saw.
    if (changesText || changesDuration) {
      const [taken, inFlight] = await Promise.all([
        tx.typingExamAttempt.count({ where: { examId: id, courseId } }),
        tx.typingExamSession.count({ where: { examId: id, courseId, status: "OPEN" } }),
      ]);
      if (taken + inFlight > 0) return { locked: true as const };
    }

    const updated = await tx.typingExam.update({ where: { id }, data });

    // Pass/fail bars changed: re-grade every recorded attempt against the new
    // bars, so the results table never shows a grade that contradicts the
    // exam's current settings. WPM and accuracy themselves never change.
    if (thresholdsChanged) {
      const attempts = await tx.typingExamAttempt.findMany({
        where: { examId: id, courseId },
        select: { id: true, wpm: true, accuracy: true, result: true },
      });
      for (const a of attempts) {
        const result = gradeAttempt(a.wpm, a.accuracy, updated);
        if (result !== a.result) await tx.typingExamAttempt.update({ where: { id: a.id }, data: { result } });
      }
    }
    return { locked: false as const, updated };
  });

  if (outcome.locked) {
    return NextResponse.json(
      { error: "এই পরীক্ষা ইতিমধ্যে কেউ দিয়েছে, তাই টেক্সট বা সময়সীমা আর বদলানো যাবে না। প্রয়োজনে নতুন একটি পরীক্ষা তৈরি করুন।" },
      { status: 409 }
    );
  }
  return NextResponse.json(outcome.updated);
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
