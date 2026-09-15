/** PUT /api/typing-game/teacher/custom-missions/[id]/batches — replace assignment. */
import { NextResponse } from "next/server";
import enErrors from "@/messages/typing-game/en/errors.json";
import {
  isRecord,
  readJson,
  teacherCustomMissionContext,
  toTeacherMissionError,
  unknownMission,
  validUuid,
} from "../../_helper";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const deps = await teacherCustomMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id } = await ctx.params;
  if (!validUuid(id)) return unknownMission();
  const body = await readJson(req);
  if (!isRecord(body) || !Array.isArray(body.batchIds)) {
    return NextResponse.json(
      { error: "MALFORMED", message: enErrors.malformedRequest },
      { status: 400 },
    );
  }
  const batchIds = body.batchIds.filter((b): b is string => typeof b === "string");
  try {
    await deps.store.setBatches(id, batchIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toTeacherMissionError(e);
  }
}
