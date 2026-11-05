import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { command, overview, type Actor } from "@/lib/incubation/server";
import { failure } from "@/lib/incubation/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const actor = await getSessionUser(req);
    if (!actor?.courseId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(
      await overview(
        actor as Actor,
        req.nextUrl.searchParams.get("programId") || undefined,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const actor = await getSessionUser(req);
    if (!actor?.courseId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (Number(req.headers.get("content-length")) > 1_000_000)
      return NextResponse.json({ error: "ডাটা অনেক বড়।" }, { status: 413 });
    return NextResponse.json(await command(actor as Actor, await req.json()));
  } catch (e) {
    return failure(e);
  }
}
