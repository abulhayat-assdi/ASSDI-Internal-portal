import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bossAdminContext, handleAdvanceInstance } from "../../../_helper";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await bossAdminContext();
  if (c instanceof NextResponse) return c;
  return handleAdvanceInstance((await ctx.params).id, c);
}
