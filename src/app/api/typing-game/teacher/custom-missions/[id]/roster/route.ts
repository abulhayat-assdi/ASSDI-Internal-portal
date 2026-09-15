/** GET /api/typing-game/teacher/custom-missions/[id]/roster */
import { NextResponse } from "next/server";
import { teacherCustomMissionContext, unknownMission, validUuid } from "../../_helper";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const deps = await teacherCustomMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id } = await ctx.params;
  if (!validUuid(id)) return unknownMission();
  const roster = await deps.store.getRoster(id);
  return NextResponse.json({ roster });
}
