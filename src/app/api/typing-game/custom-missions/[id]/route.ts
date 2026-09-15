/** GET /api/typing-game/custom-missions/[id] — mission detail + my completion. */
import { NextResponse } from "next/server";
import { customMissionContext, unknownMission, validUuid } from "../_helper";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const deps = await customMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id } = await ctx.params;
  if (!validUuid(id)) return unknownMission();
  const mission = await deps.store.getAssigned(id);
  if (!mission) return unknownMission();
  const myCompletion = await deps.store.getMyCompletion(id, deps.session.userId);
  return NextResponse.json({ mission, myCompletion });
}
