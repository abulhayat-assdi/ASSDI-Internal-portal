/**
 * POST /api/typing-game/arcade/:slug/unlock  { method: "coins" | "ad" }
 * coins — pays the game's price from the coin balance.
 * ad    — spends the rewarded-ad views the admin set for game unlocks
 *         (ads off → nothing to watch, the game unlocks directly).
 */
import { NextResponse } from "next/server";
import { findArcadeGame } from "@/lib/typing-game/arcade/catalog";
import { payForAction } from "@/lib/typing-game/ads/gate";
import { arcadeContext, arcadeError } from "../../_helper";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  if (!findArcadeGame(slug)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ctx = await arcadeContext();
  if (ctx instanceof Response) return ctx;

  let method: unknown;
  try {
    method = ((await req.json()) as { method?: unknown }).method;
  } catch {
    method = undefined;
  }
  if (method !== "coins" && method !== "ad") return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  try {
    if (method === "ad") {
      const paid = await payForAction(ctx.client, ctx.session.userId, "game_unlock", slug);
      if (!paid.ok) return NextResponse.json({ error: "ADS_REQUIRED", views: paid.views }, { status: 402 });
    }
    const r = await ctx.store.unlock(slug, method);
    return NextResponse.json({ unlocked: true, balance: r.balance, coinsSpent: r.coinsSpent });
  } catch (e) {
    return arcadeError(e, "unlock");
  }
}
