import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminContext, readJson, toError } from "../../_helper";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * null orgIds (super_admin) → global/platform-default flags.
 * Non-null orgIds (org admin) → effective flags for their own org, and
 * writes land on their org's override row only (never the global row) —
 * see fn_set_org_flag in supabase-migrations/typing-game/0041.
 */
export async function GET(_req: NextRequest): Promise<Response> {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  try {
    const orgId = ctx.orgIds === null ? null : (ctx.orgIds[0] ?? null);
    const flags = await ctx.store.getFlags(orgId);
    return NextResponse.json({ flags });
  } catch (e) {
    return toError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  routeCtx: { params: Promise<{ key: string }> },
): Promise<Response> {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const body = await readJson(req);
  if (!isRecord(body) || typeof body.enabled !== "boolean") {
    return toError(new Error("MALFORMED"));
  }
  try {
    const orgId = ctx.orgIds === null ? null : (ctx.orgIds[0] ?? null);
    await ctx.store.setFlag((await routeCtx.params).key, body.enabled, orgId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toError(e);
  }
}
