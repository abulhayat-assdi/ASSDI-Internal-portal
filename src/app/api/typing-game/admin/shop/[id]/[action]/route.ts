/**
 * POST /api/admin/shop/[id]/[action] — update, activate, deactivate.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  handleShopAction,
  readJson,
  shopAdminContext,
} from "../../_helper";

const ACTIONS = new Set(["update", "activate", "deactivate"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; action: string }> },
): Promise<Response> {
  const c = await shopAdminContext();
  if (c instanceof NextResponse) return c;
  if (!ACTIONS.has((await ctx.params).action)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return handleShopAction(
    (await ctx.params).id,
    (await ctx.params).action,
    await readJson(req),
    c,
  );
}
