/** GET list-mine, POST create — /api/typing-game/teacher/custom-missions */
import { NextResponse } from "next/server";
import enErrors from "@/messages/typing-game/en/errors.json";
import type { CustomMissionDefinitionInput } from "@/lib/typing-game/server/custom-mission-store";
import { isRecord, readJson, teacherCustomMissionContext, toTeacherMissionError } from "./_helper";

const COMPLETION_MODES = new Set(["once", "timed", "repetitions"]);
const LEADERBOARD_METRICS = new Set([
  "fastest_time",
  "highest_accuracy",
  "highest_wpm",
  "most_repetitions",
]);

function badRequest(): NextResponse {
  return NextResponse.json(
    { error: "MALFORMED", message: enErrors.malformedRequest },
    { status: 400 },
  );
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export async function GET(): Promise<Response> {
  const deps = await teacherCustomMissionContext();
  if (deps instanceof NextResponse) return deps;
  const missions = await deps.store.listMine(deps.teacherUserId);
  return NextResponse.json({ missions });
}

export async function POST(req: Request): Promise<Response> {
  const deps = await teacherCustomMissionContext();
  if (deps instanceof NextResponse) return deps;
  const body = await readJson(req);
  if (!isRecord(body)) return badRequest();

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const passageText =
    typeof body.passageText === "string" ? body.passageText.trim() : "";
  const completionMode =
    typeof body.completionMode === "string" ? body.completionMode : "";
  if (!title || title.length > 160) return badRequest();
  if (!passageText || passageText.length > 20000) return badRequest();
  if (!COMPLETION_MODES.has(completionMode)) return badRequest();

  const timeLimitSeconds = num(body.timeLimitSeconds) ?? null;
  const repetitionsTarget = num(body.repetitionsTarget) ?? null;
  if (completionMode === "timed" && !(timeLimitSeconds && timeLimitSeconds > 0)) {
    return badRequest();
  }
  if (
    completionMode === "repetitions" &&
    !(repetitionsTarget && repetitionsTarget > 0)
  ) {
    return badRequest();
  }

  const leaderboardMetric =
    typeof body.leaderboardMetric === "string" &&
    LEADERBOARD_METRICS.has(body.leaderboardMetric)
      ? body.leaderboardMetric
      : "fastest_time";
  const batchIds = Array.isArray(body.batchIds)
    ? body.batchIds.filter((b): b is string => typeof b === "string")
    : [];

  const input: CustomMissionDefinitionInput = {
    title,
    description: typeof body.description === "string" ? body.description : "",
    passageText,
    completionMode: completionMode as CustomMissionDefinitionInput["completionMode"],
    timeLimitSeconds,
    repetitionsTarget,
    minAccuracy: num(body.minAccuracy) ?? null,
    minWpm: num(body.minWpm) ?? null,
    leaderboardMetric: leaderboardMetric as CustomMissionDefinitionInput["leaderboardMetric"],
    rewardXp: Math.max(0, Math.floor(num(body.rewardXp) ?? 0)),
    rewardCoins: Math.max(0, Math.floor(num(body.rewardCoins) ?? 0)),
    batchIds,
  };

  try {
    const id = await deps.store.create(input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return toTeacherMissionError(e);
  }
}
