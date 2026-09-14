/**
 * GET /api/competitions/[id]/results â€” finalized/own result rows.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { competitionContext, handleResults } from "../../_helper";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await competitionContext();
  if (c instanceof NextResponse) return c;
  return handleResults((await ctx.params).id, c);
}
