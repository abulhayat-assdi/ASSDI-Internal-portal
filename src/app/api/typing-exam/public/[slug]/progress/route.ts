export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { resolvePublicExam } from "@/lib/typing-exam/publicExam";
import { parseClientSnapshot, readJsonBody } from "@/lib/typing-exam/session";
import { findOwnedSession, saveProgress } from "@/lib/typing-exam/sessionStore";
import { HOUR, limitFromEnv, rateLimitByIp } from "@/lib/rateLimit";

type RouteParams = { params: Promise<{ slug: string }> };

// POST /api/typing-exam/public/[slug]/progress
// Autosave for an in-flight run (every few seconds, and via sendBeacon when
// the tab is hidden or closed). If the taker never submits, this is what
// their attempt is graded from. A whole class shares one IP and each run
// saves ~20 times a minute, hence the generous separate budget.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const limited = rateLimitByIp(req, "typing-exam-progress", limitFromEnv("EXAM_PROGRESS", 20000), HOUR);
  if (limited) return limited;

  const { slug } = await params;
  const resolved = await resolvePublicExam(slug, { requireOpen: false });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { exam } = resolved;

  const body = await readJsonBody(req);
  const snapshot = parseClientSnapshot(body, exam.examText);
  if (!snapshot) {
    return NextResponse.json({ error: "invalid_submission" }, { status: 400 });
  }

  const outcome = await withCourseContext({ courseId: exam.courseId, isSuperAdmin: false }, async (tx) => {
    const session = await findOwnedSession(tx, exam.id, body.sessionId, { token: body.sessionToken });
    if (!session) return null;
    return saveProgress(tx, exam, session, snapshot);
  });
  if (outcome === null) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  return NextResponse.json({ status: outcome });
}
