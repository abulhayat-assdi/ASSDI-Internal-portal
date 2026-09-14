/**
 * POST /api/tournaments/[id]/register — self-registration (students) or
 * clan registration by clan staff (identity proven server-side).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  handleRegister,
  readJson,
  tournamentContext,
} from "../../_helper";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const c = await tournamentContext();
  if (c instanceof NextResponse) return c;
  return handleRegister((await ctx.params).id, await readJson(req), c);
}
