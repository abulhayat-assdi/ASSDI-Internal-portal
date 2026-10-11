export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { normalizePhone } from "@/lib/typing-exam/identity";
import { retryPasswordMatches } from "@/lib/typing-exam/retryGate";
import { resolvePublicExam } from "@/lib/typing-exam/publicExam";
import { parseClientSnapshot, readJsonBody } from "@/lib/typing-exam/session";
import { finalizeSession, findOwnedSession, resultBody, submitWithoutSession } from "@/lib/typing-exam/sessionStore";
import { HOUR, limitFromEnv, rateLimitByIp } from "@/lib/rateLimit";

type RouteParams = { params: Promise<{ slug: string }> };

// POST /api/typing-exam/public/[slug]/attempt
// The authoritative write path. With a sessionId (normal flow) it finalizes
// that run — idempotently, so a retried submit returns the same result.
// Without one (the /start call failed, or a tab opened before this engine)
// it re-validates the exam and the retry-password gate itself. Either way
// the score is computed server-side from the submitted snapshot.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const limited = rateLimitByIp(req, "typing-exam-attempt", limitFromEnv("EXAM_ATTEMPT", 300), HOUR);
  if (limited) return limited;

  const { slug } = await params;
  const body = await readJsonBody(req);
  const hasSession = typeof body.sessionId === "string" && body.sessionId !== "";

  // A run already in progress is finished even if the exam closed meanwhile.
  const resolved = await resolvePublicExam(slug, { requireOpen: !hasSession });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { exam } = resolved;

  const snapshot = parseClientSnapshot(body, exam.examText);
  if (!snapshot) {
    return NextResponse.json({ error: "invalid_submission" }, { status: 400 });
  }

  const outcome = await withCourseContext({ courseId: exam.courseId, isSuperAdmin: false }, async (tx) => {
    if (hasSession) {
      const session = await findOwnedSession(tx, exam.id, body.sessionId, { token: body.sessionToken });
      if (!session) return { status: 404 as const, body: { error: "session_not_found" } };
      const recorded = await finalizeSession(tx, exam, session.id, snapshot);
      if (!recorded) return { status: 409 as const, body: { error: "session_closed" } };
      return { status: 200 as const, body: resultBody(recorded) };
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const roll = typeof body.roll === "string" ? body.roll.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!name || !roll || !phone) return { status: 400 as const, body: { error: "missing_fields" } };

    const res = await submitWithoutSession(
      tx,
      exam,
      { type: "PUBLIC", name, roll, phone: normalizePhone(phone) },
      snapshot,
      () => retryPasswordMatches(body.password, exam.retryPasswordHash)
    );
    if (!res.ok) return { status: 401 as const, body: { needsPassword: true } };
    const r = res.recorded;
    return { status: 200 as const, body: resultBody(r) };
  });

  return NextResponse.json(outcome.body, { status: outcome.status });
}
