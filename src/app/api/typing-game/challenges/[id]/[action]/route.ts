/**
 * POST /api/typing-game/challenges/:id/:action
 *   accept | decline | cancel        — answer or withdraw an invitation
 *   begin                            — async: start my run (server clock starts)
 *   progress { progress, errors }    — live: how far I am
 *   finish   { progress, errors }    — end my run; the server measures the time
 */
import { NextResponse } from "next/server";
import { challengeContext, challengeError, readBody } from "../../_helper";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(10000, Math.floor(v))) : 0);

export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }): Promise<Response> {
  const { id, action } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ctx = await challengeContext();
  if (ctx instanceof Response) return ctx;
  try {
    switch (action) {
      case "accept":
      case "decline":
      case "cancel":
        return NextResponse.json({ status: await ctx.store.respond(id, action) });
      case "begin":
        return NextResponse.json(await ctx.store.begin(id));
      case "progress": {
        const b = await readBody(req);
        await ctx.store.progress(id, int(b.progress), int(b.errors));
        return NextResponse.json({ ok: true });
      }
      case "finish": {
        const b = await readBody(req);
        return NextResponse.json(await ctx.store.finish(id, int(b.progress), int(b.errors)));
      }
      default:
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
  } catch (e) {
    return challengeError(e, action);
  }
}
