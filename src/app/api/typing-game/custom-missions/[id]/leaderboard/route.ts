/** GET /api/typing-game/custom-missions/[id]/leaderboard */
import { NextResponse } from "next/server";
import { customMissionContext, unknownMission, validUuid } from "../../_helper";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const deps = await customMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id } = await ctx.params;
  if (!validUuid(id)) return unknownMission();
  const rows = await deps.store.getLeaderboard(id);
  return NextResponse.json({ rows });
}
