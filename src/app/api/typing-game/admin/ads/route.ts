/**
 * GET/PUT /api/typing-game/admin/ads — platform super-admin only.
 * PUT body: any subset of { enabled, display_enabled, rewarded_enabled, provider,
 * publisher_id, slots, action_views, rewarded_daily_limit, min_watch_seconds,
 * no_fill, exempt_batch_ids }. The database function re-checks super-admin.
 */
import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";
import { AuthApiError, requireSuperAdmin } from "@/lib/typing-game/server/staff";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";
import { sanitizeAdPatch } from "@/lib/typing-game/ads/patch";

async function gate() {
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  try {
    await requireSuperAdmin(client);
  } catch (e) {
    if (e instanceof AuthApiError) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    throw e;
  }
  return client;
}

export async function GET(): Promise<Response> {
  const client = await gate();
  if (client instanceof Response) return client;
  const store = createAdsStore(client);
  return NextResponse.json({ settings: await store.settings(), report: await store.report() });
}

export async function PUT(req: Request): Promise<Response> {
  const client = await gate();
  if (client instanceof Response) return client;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const patch = sanitizeAdPatch(body);
  if (!patch) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  try {
    await createAdsStore(client).update(patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("FORBIDDEN")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[typing-game/admin/ads]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
