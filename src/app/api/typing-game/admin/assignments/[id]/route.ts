import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminContext, toError } from "../../_helper";
import { ForbiddenError } from "@/lib/typing-game/server/staff-store";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ac = await adminContext();
  if (ac instanceof NextResponse) return ac;
  const { id } = await ctx.params;
  try {
    const all = await ac.store.listAssignments();
    if (!all.some((a) => a.id === id)) {
      throw new ForbiddenError();
    }
    await ac.store.deleteAssignment(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toError(e);
  }
}
