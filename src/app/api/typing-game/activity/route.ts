/**
 * POST /api/typing-game/activity  { ms }
 * Adds practice typing time to today's total (lessons and tests add theirs
 * on the server when they are saved). One call counts at most 1 hour.
 */
import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";
import { createActivityStore } from "@/lib/typing-game/server/activity-store";

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  let ms = 0;
  try {
    ms = Number(((await req.json()) as { ms?: unknown }).ms);
  } catch {
    /* empty */
  }
  if (!Number.isFinite(ms) || ms <= 0 || ms > 3600000) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  await createActivityStore(client).addTime(ms);
  return NextResponse.json({ ok: true });
}
