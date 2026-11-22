/** GET /api/typing-game/challenges/:id[?presence=1] — one challenge as I may see it. */
import { NextResponse } from "next/server";
import { challengeContext, challengeError } from "../_helper";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ctx = await challengeContext();
  if (ctx instanceof Response) return ctx;
  try {
    const presence = new URL(req.url).searchParams.get("presence") === "1";
    return NextResponse.json(await ctx.store.state(id, presence), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return challengeError(e, "state");
  }
}
