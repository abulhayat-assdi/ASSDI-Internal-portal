/**
 * GET /api/shop/[id] — item detail with ownership.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleGetItem, shopContext } from "../_helper";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const c = await shopContext();
  if (c instanceof NextResponse) return c;
  return handleGetItem((await ctx.params).id, c);
}
