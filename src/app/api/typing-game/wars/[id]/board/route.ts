import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleBoard, warContext } from "../../_helper";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await warContext();
  if (c instanceof NextResponse) return c;
  return handleBoard((await ctx.params).id, c);
}
