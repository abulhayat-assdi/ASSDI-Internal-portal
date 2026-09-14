import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bossAdminContext, handleActivateInstance } from "../../../_helper";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await bossAdminContext();
  if (c instanceof NextResponse) return c;
  return handleActivateInstance((await ctx.params).id, c);
}
