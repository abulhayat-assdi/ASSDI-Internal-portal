import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  command,
  overview,
  featureTx,
  type Actor,
} from "@/lib/incubation/server";
import { failure } from "@/lib/incubation/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const actor = await getSessionUser(req);
    if (!actor?.courseId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const cid = req.nextUrl.searchParams.get("competitionId");
    const pid = cid
      ? await featureTx(
          actor as Actor,
          async (tx) =>
            (
              await tx.incubationProgram.findFirst({
                where: { competitionId: cid },
                select: { id: true },
              })
            )?.id,
        )
      : req.nextUrl.searchParams.get("programId");
    if (cid && !pid)
      return NextResponse.json(
        { error: "Competition not found." },
        { status: 404 },
      );
    return NextResponse.json(await overview(actor as Actor, pid || undefined));
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
      return NextResponse.json({ error: "The request is too large." }, { status: 413 });
    return NextResponse.json(await command(actor as Actor, await req.json()));
  } catch (e) {
    return failure(e);
  }
}
