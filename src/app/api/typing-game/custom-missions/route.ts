/** GET /api/typing-game/custom-missions — missions assigned to my batch(es). */
import { NextResponse } from "next/server";
import { customMissionContext } from "./_helper";

export async function GET(): Promise<Response> {
  const ctx = await customMissionContext();
  if (ctx instanceof NextResponse) return ctx;
  const missions = await ctx.store.listAssigned(ctx.session.userId);
  return NextResponse.json({ missions });
}
