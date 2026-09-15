/** POST /api/typing-game/custom-missions/[id]/attempts/start */
import { NextResponse } from "next/server";
import {
  customMissionContext,
  toCustomMissionError,
  unknownMission,
  validUuid,
} from "../../../_helper";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const deps = await customMissionContext();
  if (deps instanceof NextResponse) return deps;
  const { id } = await ctx.params;
  if (!validUuid(id)) return unknownMission();
  try {
    const attempt = await deps.store.startAttempt(id);
    return NextResponse.json(
      {
        attemptId: attempt.id,
        expectedText: attempt.expectedText,
        expiresAt: attempt.expiresAt,
      },
      { status: 201 },
    );
  } catch (e) {
    return toCustomMissionError(e);
  }
}
