/**
 * POST /api/typing-game/ads/views/:viewId/complete  { noFill? }
 * Marks a view watched. The server checks the minimum watch time on its own clock.
 */
import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";

export async function POST(req: Request, { params }: { params: Promise<{ viewId: string }> }): Promise<Response> {
  const { viewId } = await params;
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(viewId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  let noFill = false;
  try {
    noFill = ((await req.json()) as { noFill?: unknown }).noFill === true;
  } catch {
    /* empty body */
  }
  try {
    const ok = await createAdsStore(client).completeView(viewId, noFill);
    return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "NOT_COUNTED" }, { status: 409 });
  } catch (e) {
    console.error("[typing-game/ads/complete]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
