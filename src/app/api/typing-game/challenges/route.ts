/**
 * GET  /api/typing-game/challenges — my challenges, record, batch standings and batchmates.
 * POST /api/typing-game/challenges — invite a batchmate: { opponentId, mode: "async" | "live" }.
 */
import { NextResponse } from "next/server";
import { pickChallengePassage } from "@/lib/typing-game/challenge/passages.server";
import { challengeContext, challengeError, readBody } from "./_helper";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(): Promise<Response> {
  const ctx = await challengeContext();
  if (ctx instanceof Response) return ctx;
  try {
    const [overview, batchmates] = await Promise.all([ctx.store.overview(), ctx.store.batchmates()]);
    return NextResponse.json({ ...overview, batchmates, me: ctx.session.userId });
  } catch (e) {
    return challengeError(e, "list");
  }
}

export async function POST(req: Request): Promise<Response> {
  const ctx = await challengeContext();
  if (ctx instanceof Response) return ctx;
  const body = await readBody(req);
  const opponentId = typeof body.opponentId === "string" ? body.opponentId : "";
  const mode = body.mode === "live" ? "live" : body.mode === "async" ? "async" : null;
  if (!UUID.test(opponentId) || !mode) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  try {
    const id = await ctx.store.create(opponentId, mode, pickChallengePassage());
    return NextResponse.json({ id });
  } catch (e) {
    return challengeError(e, "create");
  }
}
