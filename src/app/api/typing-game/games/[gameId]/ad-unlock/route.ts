/**
 * POST /api/typing-game/games/[gameId]/ad-unlock
 *
 * Mock "watch an ad to unlock" action — unlocks immediately on call, no real
 * ad network wired up yet (see content/access-overrides.ts). Re-validates
 * the slug is actually eligible server-side (never trust the client to only
 * call this for a legitimate game); the actual write goes through
 * fn_ad_unlock_game, a SECURITY DEFINER function, since game_unlocks has no
 * direct write policy for any API role.
 *
 * Segment is named `gameId` (not `slug`) to match the sibling routes under
 * games/[gameId]/... — Next.js requires one dynamic-segment name per
 * directory level; the value itself is still the game's slug string, same
 * as every other route here.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AD_UNLOCKABLE_GAME_SLUGS } from "@/lib/typing-game/content";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ gameId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  const { gameId: slug } = await ctx.params;
  if (!AD_UNLOCKABLE_GAME_SLUGS.includes(slug)) {
    return NextResponse.json({ error: "NOT_AD_UNLOCKABLE" }, { status: 400 });
  }

  const client = await userDbClient();
  if (!client) {
    return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }

  const res = await client.rpc("fn_ad_unlock_game", { p_game_slug: slug });
  if (res.error) {
    return NextResponse.json({ error: "UNLOCK_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ unlocked: true, slug });
}
