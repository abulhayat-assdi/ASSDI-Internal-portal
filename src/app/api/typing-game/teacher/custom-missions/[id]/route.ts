/** GET detail, PATCH draft update — /api/typing-game/teacher/custom-missions/[id] */
import { NextResponse } from "next/server";
import enErrors from "@/messages/typing-game/en/errors.json";
import {
  isRecord,
  readJson,
  teacherCustomMissionContext,
  toTeacherMissionError,
  unknownMission,
  validUuid,
} from "../_helper";

function badRequest(): NextResponse {
  return NextResponse.json(
    { error: "MALFORMED", message: enErrors.malformedRequest },
    { status: 400 },
  );
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const deps = await teacherCustomMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id } = await ctx.params;
  if (!validUuid(id)) return unknownMission();
  const mission = await deps.store.getForManage(id);
  if (!mission) return unknownMission();
  return NextResponse.json({ mission });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const deps = await teacherCustomMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id } = await ctx.params;
  if (!validUuid(id)) return unknownMission();
  const body = await readJson(req);
  if (!isRecord(body)) return badRequest();

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    if (body.title.length > 160) return badRequest();
    patch.title = body.title.trim();
  }
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.passageText === "string" && body.passageText.trim()) {
    patch.passageText = body.passageText.trim();
  }
  if (typeof body.completionMode === "string") patch.completionMode = body.completionMode;
  if (typeof body.timeLimitSeconds === "number" || body.timeLimitSeconds === null) {
    patch.timeLimitSeconds = body.timeLimitSeconds;
  }
  if (typeof body.repetitionsTarget === "number" || body.repetitionsTarget === null) {
    patch.repetitionsTarget = body.repetitionsTarget;
  }
  if (typeof body.minAccuracy === "number" || body.minAccuracy === null) {
    patch.minAccuracy = body.minAccuracy;
  }
  if (typeof body.minWpm === "number" || body.minWpm === null) {
    patch.minWpm = body.minWpm;
  }
  if (typeof body.leaderboardMetric === "string") {
    patch.leaderboardMetric = body.leaderboardMetric;
  }
  if (typeof body.rewardXp === "number") patch.rewardXp = Math.max(0, Math.floor(body.rewardXp));
  if (typeof body.rewardCoins === "number") {
    patch.rewardCoins = Math.max(0, Math.floor(body.rewardCoins));
  }

  try {
    await deps.store.updateDraft(id, patch);
    if (Array.isArray(body.batchIds)) {
      const batchIds = body.batchIds.filter((b): b is string => typeof b === "string");
      await deps.store.setBatches(id, batchIds);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toTeacherMissionError(e);
  }
}
