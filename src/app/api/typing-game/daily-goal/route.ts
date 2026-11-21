/** PUT /api/typing-game/daily-goal  { minutes } — 5, 10, 15, 20, 30, 45 or 60. */
import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";
import { GOAL_CHOICES, createActivityStore } from "@/lib/typing-game/server/activity-store";

export async function PUT(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  let minutes = 0;
  try {
    minutes = Number(((await req.json()) as { minutes?: unknown }).minutes);
  } catch {
    /* empty */
  }
  if (!(GOAL_CHOICES as readonly number[]).includes(minutes)) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  try {
    await createActivityStore(client).setGoal(minutes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[typing-game/daily-goal]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
