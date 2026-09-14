/**
 * GET /api/bosses/[instanceId] — privacy-safe boss state.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bossContext, handleGetBoss } from "../_helper";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const c = await bossContext();
  if (c instanceof NextResponse) return c;
  return handleGetBoss((await ctx.params).instanceId, c);
}
