/** POST /api/typing-game/teacher/custom-missions/[id]/activate */
import { NextResponse } from "next/server";
import { teacherCustomMissionContext, toTeacherMissionError, unknownMission, validUuid } from "../../_helper";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const deps = await teacherCustomMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id } = await ctx.params;
  if (!validUuid(id)) return unknownMission();
  try {
    await deps.store.setStatus(id, "active");
    return NextResponse.json({ ok: true, status: "active" });
  } catch (e) {
    return toTeacherMissionError(e);
  }
}
