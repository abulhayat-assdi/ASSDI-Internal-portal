/**
 * GET /api/tournaments/[id] — tournament detail with bracket.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleGetTournament, tournamentContext } from "../_helper";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const c = await tournamentContext();
  if (c instanceof NextResponse) return c;
  return handleGetTournament((await ctx.params).id, c);
}
