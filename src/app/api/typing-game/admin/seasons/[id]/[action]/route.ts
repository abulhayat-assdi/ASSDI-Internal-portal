import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  handleSeasonAction,
  readJson,
  seasonAdminContext,
} from "../../_helper";

const ACTIONS = new Set([
  "schedule",
  "activate",
  "cancel",
  "advance",
  "source",
  "tier",
  "update",
]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; action: string }> },
): Promise<Response> {
  const c = await seasonAdminContext();
  if (c instanceof NextResponse) return c;
  if (!ACTIONS.has((await ctx.params).action)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return handleSeasonAction(
    (await ctx.params).id,
    (await ctx.params).action,
    await readJson(req),
    c,
  );
}
