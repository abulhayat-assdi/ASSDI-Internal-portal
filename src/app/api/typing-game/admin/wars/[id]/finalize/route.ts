import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { toWarError } from "../../../../wars/_helper";
import { unknownWar, validWarId, warAdminStore } from "../../_helper";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!validWarId((await ctx.params).id)) return unknownWar();
  const store = await warAdminStore();
  if (store instanceof NextResponse) return store;
  try {
    return NextResponse.json(await store.finalize((await ctx.params).id));
  } catch (e) {
    return toWarError(e);
  }
}
