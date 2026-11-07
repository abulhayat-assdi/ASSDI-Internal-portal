import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fieldCommand, fieldCorrectionCommand } from "@/lib/incubation/field";
import { featureTx, accessProgram, type Actor } from "@/lib/incubation/server";
import { insist } from "@/lib/incubation/domain";
import { failure } from "@/lib/incubation/http";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const a = await getSessionUser(req);
    if (!a?.courseId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    return NextResponse.json(
      await (["field_correct", "field_review", "field_force_checkout"].includes(body.action)
        ? fieldCorrectionCommand(a as Actor, body)
        : fieldCommand(a as Actor, body)),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: NextRequest) {
  try {
    const a = await getSessionUser(req);
    insist(a?.courseId, "Unauthorized", 401);
    const actor = a as Actor,
      programId = req.nextUrl.searchParams.get("programId") || "",
      sessionId = req.nextUrl.searchParams.get("sessionId") || "";
    return NextResponse.json(
      await featureTx(actor, async (tx) => {
        const { member } = await accessProgram(tx, actor, programId);
        const field = await tx.incubationFieldSession.findFirst({
          where: { id: sessionId, programId },
        });
        insist(field, "Session not found.", 404);
        insist(
          actor.role !== "student" ||
            field.userId === actor.id ||
            (!!member?.isLead && field.teamId === member.teamId),
          "You can only view your own location history.",
          403,
        );
        return {
          positions: await tx.incubationPosition.findMany({
            where: { sessionId },
            orderBy: { capturedAt: "asc" },
          }),
        };
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
