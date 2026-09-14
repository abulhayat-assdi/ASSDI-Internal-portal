import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleMissionStatus, missionAdminContext } from "../../_helper";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await missionAdminContext();
  if (c instanceof NextResponse) return c;
  return handleMissionStatus((await ctx.params).id, "active", c);
}
