/**
 * POST /api/typing-game/games/[gameId]/ad-unlock
 *
 * "Watch an ad to unlock" action. The client shows a timed sponsor modal
 * (see components/typing-game/ad-unlock-button.tsx) and POSTs a watch-proof
 * `{ proof: { provider, watchMs, completedAt } }`; the server re-validates
 * it with validateWatchProof() (never trusts the client to only call this
 * for a legitimate game OR to actually have watched). A body-less POST is
 * still accepted as the legacy instant-mock path so older clients/tests
 * keep working.
 *
 * Segment is named `gameId` (not `slug`) to match the sibling routes under
 * games/[gameId]/... — Next.js requires one dynamic-segment name per
 * directory level; the value itself is still the game's slug string, same
 * as every other route here.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AD_UNLOCKABLE_GAME_SLUGS } from "@/lib/typing-game/content";
import { validateWatchProof } from "@/lib/typing-game/ads";
import { getSession, unauthorized, userDbClient } from "@/lib/typing-game/server/auth";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ gameId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  const { gameId: slug } = await ctx.params;
  if (!AD_UNLOCKABLE_GAME_SLUGS.includes(slug)) {
    return NextResponse.json({ error: "NOT_AD_UNLOCKABLE" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const proof = body && typeof body === "object" ? (body as { proof?: unknown }).proof : undefined;
  if (proof !== undefined) {
    const reason = validateWatchProof(proof);
    if (reason) {
      return NextResponse.json({ error: reason }, { status: 400 });
    }
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
