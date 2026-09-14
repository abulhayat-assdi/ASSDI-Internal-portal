export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission } from "@/lib/auth";
import { validateThresholds } from "@/lib/typing-exam/scoring";
import { pickBankPassage, type ExamTextLanguage } from "@/lib/typing-exam/content";
import { makePublicExamSlug } from "@/lib/typing-exam/slug";

// GET /api/typing-exam — list exams for the course + active batches for the create-form dropdown
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !hasRequiredPermission(user, "typing_exam")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;

  const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
    const exams = await tx.typingExam.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
    });

    const counts = await tx.typingExamAttempt.groupBy({
      by: ["examId"],
      where: { courseId },
      _count: { id: true },
    });
    const countMap = new Map(counts.map((c) => [c.examId, c._count.id]));

    const batches = await tx.batch.findMany({
      where: { courseId, status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return {
      exams: exams.map((e) => ({
        ...e,
        attemptCount: countMap.get(e.id) ?? 0,
      })),
      batches,
    };
  });

  return NextResponse.json(result);
}

// POST /api/typing-exam — create a new exam
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !hasRequiredPermission(user, "typing_exam")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;

  const body = await req.json().catch(() => ({}));
  const {
    title,
    description,
    accessType,
    batchNames,
    durationSeconds,
    passWpm,
    passAccuracy,
    failWpm,
    failAccuracy,
    textSource,
    textLanguage,
    customText,
    retryPassword,
    scheduleStart,
    scheduleEnd,
  } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "শিরোনাম আবশ্যক" }, { status: 400 });
  }

  const thresholds = {
    passWpm: Number(passWpm),
    passAccuracy: Number(passAccuracy),
    failWpm: Number(failWpm),
    failAccuracy: Number(failAccuracy),
  };
  if (
    Number.isNaN(thresholds.passWpm) ||
    Number.isNaN(thresholds.passAccuracy) ||
    Number.isNaN(thresholds.failWpm) ||
    Number.isNaN(thresholds.failAccuracy)
  ) {
    return NextResponse.json({ error: "সবগুলো থ্রেশহোল্ড ভ্যালু সংখ্যা হতে হবে" }, { status: 400 });
  }
  const thresholdError = validateThresholds(thresholds);
  if (thresholdError) {
    return NextResponse.json({ error: thresholdError }, { status: 400 });
  }

  const resolvedAccessType = accessType === "PUBLIC" ? "PUBLIC" : "INTERNAL";

  let resolvedBatchNames: string[] = [];
  if (resolvedAccessType === "INTERNAL") {
    if (!Array.isArray(batchNames) || batchNames.length === 0) {
      return NextResponse.json({ error: "Internal exam-এর জন্য অন্তত একটি ব্যাচ নির্বাচন করুন" }, { status: 400 });
    }
    resolvedBatchNames = batchNames;
  }

  const resolvedTextSource = textSource === "BANK" ? "BANK" : "CUSTOM";
  const resolvedLanguage: ExamTextLanguage = textLanguage === "bn" ? "bn" : "en";

  let examText = "";
  if (resolvedTextSource === "CUSTOM") {
    if (!customText || typeof customText !== "string" || !customText.trim()) {
      return NextResponse.json({ error: "Custom টেক্সট আবশ্যক" }, { status: 400 });
    }
    examText = customText;
  } else {
    examText = pickBankPassage(resolvedLanguage);
  }

  if (!retryPassword || typeof retryPassword !== "string" || !retryPassword.trim()) {
    return NextResponse.json({ error: "Retry password আবশ্যক" }, { status: 400 });
  }
  const retryPasswordHash = await bcrypt.hash(retryPassword, 10);

  const publicSlug: string | null = resolvedAccessType === "PUBLIC" ? makePublicExamSlug(title) : null;

  const exam = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    tx.typingExam.create({
      data: {
        courseId,
        title: title.trim(),
        description: typeof description === "string" ? description : "",
        accessType: resolvedAccessType,
        batchNames: resolvedBatchNames,
        durationSeconds: Number(durationSeconds) > 0 ? Number(durationSeconds) : 60,
        passWpm: thresholds.passWpm,
        passAccuracy: thresholds.passAccuracy,
        failWpm: thresholds.failWpm,
        failAccuracy: thresholds.failAccuracy,
        textSource: resolvedTextSource,
        textLanguage: resolvedLanguage,
        examText,
        scheduleStart: scheduleStart ? new Date(scheduleStart) : null,
        scheduleEnd: scheduleEnd ? new Date(scheduleEnd) : null,
        publicSlug,
        retryPasswordHash,
        createdByUid: user.id,
        createdByName: user.displayName ?? "",
        createdByRole: user.role ?? "",
      },
    })
  );

  return NextResponse.json(exam, { status: 201 });
}
