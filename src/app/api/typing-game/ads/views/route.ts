/**
 * POST /api/typing-game/ads/views  { action, target }
 * Starts one rewarded-ad view (refused while ads are off or past the daily limit).
 */
import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";
import { AD_ACTIONS } from "@/lib/typing-game/ads/settings";

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  let body: { action?: unknown; target?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body */
  }
  const action = AD_ACTIONS.find((a) => a.key === body.action)?.key;
  const target = typeof body.target === "string" ? body.target.slice(0, 80) : "";
  if (!action) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  const store = createAdsStore(client);
  try {
    const settings = await store.settings();
    const viewId = await store.startView(action, target);
    return NextResponse.json({ viewId, minWatchSeconds: settings.minWatchSeconds, provider: settings.provider, noFill: settings.noFill });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("ADS_OFF")) return NextResponse.json({ error: "ADS_OFF" }, { status: 409 });
    if (msg.includes("DAILY_LIMIT")) return NextResponse.json({ error: "DAILY_LIMIT" }, { status: 429 });
    console.error("[typing-game/ads/views]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
