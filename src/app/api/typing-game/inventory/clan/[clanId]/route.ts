/**
 * GET /api/inventory/clan/[clanId] — clan-owned items (viewers only).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleGetClanInventory, shopContext } from "../../../shop/_helper";

type Ctx = { params: Promise<{ clanId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const c = await shopContext();
  if (c instanceof NextResponse) return c;
  return handleGetClanInventory((await ctx.params).clanId, c);
}
