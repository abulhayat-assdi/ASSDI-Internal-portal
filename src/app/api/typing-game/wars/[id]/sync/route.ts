import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleSync, warContext } from "../../_helper";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await warContext();
  if (c instanceof NextResponse) return c;
  return handleSync((await ctx.params).id, c);
}
