import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  handleCompetitionAction,
  staffCompetitionContext,
} from "../../_helper";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await staffCompetitionContext();
  if (c instanceof NextResponse) return c;
  return handleCompetitionAction((await ctx.params).id, "open", c);
}
