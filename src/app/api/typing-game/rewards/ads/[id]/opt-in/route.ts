/**
 * POST /api/rewards/ads/[id]/opt-in — explicit user opt-in.
 */
import { NextResponse } from "next/server";
import { handleOptIn, rewardedContext } from "../../_helper";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  const c = await rewardedContext();
  if (c instanceof NextResponse) return c;
  return handleOptIn((await ctx.params).id, c);
}
