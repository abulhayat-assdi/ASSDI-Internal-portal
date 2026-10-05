export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { normalizePhone } from "@/lib/typing-exam/identity";
import { retryPasswordMatches } from "@/lib/typing-exam/retryGate";
import { resolvePublicExam } from "@/lib/typing-exam/publicExam";
import { readJsonBody } from "@/lib/typing-exam/session";
import { startSession } from "@/lib/typing-exam/sessionStore";
import { HOUR, limitFromEnv, rateLimitByIp } from "@/lib/rateLimit";

type RouteParams = { params: Promise<{ slug: string }> };

// POST /api/typing-exam/public/[slug]/start
// Opens a server-side session for one run, called as the 3-2-1 countdown
// begins. Returns a bearer token the page uses for autosave and submit.
// Re-runs the retry-password gate itself (it is a credential oracle, hence
// a cap like /check's — in its own bucket, so check + start for a whole
// class behind one address doesn't spend a single budget twice).
export async function POST(req: NextRequest, { params }: RouteParams) {
  const limited = rateLimitByIp(req, "typing-exam-start", limitFromEnv("EXAM_START", 300), HOUR);
  if (limited) return limited;

  const { slug } = await params;
  const resolved = await resolvePublicExam(slug, { requireOpen: true });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { exam } = resolved;

  const body = await readJsonBody(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const roll = typeof body.roll === "string" ? body.roll.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!name || !roll || !phone) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const started = await withCourseContext({ courseId: exam.courseId, isSuperAdmin: false }, (tx) =>
    startSession(tx, exam, { type: "PUBLIC", name, roll, phone: normalizePhone(phone) }, () =>
      retryPasswordMatches(body.password, exam.retryPasswordHash)
    )
  );
  if (!started.ok) {
    return NextResponse.json({ needsPassword: true }, { status: 401 });
  }
  return NextResponse.json({ sessionId: started.sessionId, sessionToken: started.token });
}
