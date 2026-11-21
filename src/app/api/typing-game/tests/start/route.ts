/**
 * POST /api/typing-game/tests/start  { testId, lang }
 * Picks fresh text on the server and opens a session holding it.
 */
import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";
import { createTestStore } from "@/lib/typing-game/server/test-store";
import { findTest, testText } from "@/lib/typing-game/tests/catalog";
import { isBanglaModeUnlocked } from "@/lib/typing-game/practice/modes";

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });

  let body: { testId?: unknown; lang?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const test = typeof body.testId === "string" ? findTest(body.testId) : null;
  const lang = body.lang === "bn" ? "bn" : body.lang === "en" || body.lang === undefined ? "en" : null;
  if (!test || !lang) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  if (lang === "bn" && !(await isBanglaModeUnlocked())) {
    return NextResponse.json({ error: "BANGLA_LOCKED" }, { status: 403 });
  }

  try {
    const text = testText(test, lang, Math.floor(Math.random() * 1e9) + 1);
    const sessionId = await createTestStore(client).start(test.id, lang, text, test.seconds);
    return NextResponse.json({ sessionId, text, seconds: test.seconds });
  } catch (e) {
    console.error("[typing-game/tests/start]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
