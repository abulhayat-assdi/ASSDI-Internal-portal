import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clanContext, handleSyncClanMission } from "../../../_helper";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await clanContext();
  if (c instanceof NextResponse) return c;
  return handleSyncClanMission((await ctx.params).id, c);
}
