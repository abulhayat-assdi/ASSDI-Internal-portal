/**
 * POST /api/competitions/[id]/attach â€” attach one validated attempt, or
 * (with {"latest": true}) the caller's latest validated attempt.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  competitionContext,
  handleAttach,
  handleAttachLatest,
  isRecord,
  readJson,
} from "../../_helper";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const c = await competitionContext();
  if (c instanceof NextResponse) return c;
  const body = await readJson(req);
  if (isRecord(body) && body.latest === true) {
    return handleAttachLatest((await ctx.params).id, c);
  }
  return handleAttach((await ctx.params).id, body, c);
}
