import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { featureTx, accessProgram, type Actor } from "@/lib/incubation/server";
import { insist } from "@/lib/incubation/domain";
import { failure } from "@/lib/incubation/http";
export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await getSessionUser(req);
    insist(a?.courseId, "Unauthorized", 401);
    const actor = a as Actor,
      { id } = await params;
    const file = await featureTx(actor, async (tx) => {
      const f = await tx.incubationAttachment.findFirst({
        where: { id, courseId: actor.courseId },
      });
      insist(f, "ফাইল পাওয়া যায়নি।", 404);
      const { member } = await accessProgram(tx, actor, f.programId);
      const linked = member
        ? await tx.incubationRecord.findFirst({
            where: {
              programId: f.programId,
              kind: "transfer",
              status: "posted",
              OR: [{ teamId: member.teamId }, { targetTeamId: member.teamId }],
              data: { path: ["voucherId"], equals: f.id },
            },
            select: { id: true },
          })
        : null;
      insist(
        !member ||
          (member.isLead && f.teamId === member.teamId) ||
          f.uploadedBy === actor.id ||
          (member.isLead && linked),
        "এই ফাইলের অনুমতি নেই।",
        403,
      );
      return f;
    });
    const base = path.resolve(
        process.env.LOCAL_STORAGE_PATH ||
          process.env.UPLOAD_DIR ||
          path.join(process.cwd(), "storage"),
      ),
      absolute = path.resolve(base, file.path);
    insist(absolute.startsWith(base + path.sep), "অবৈধ ফাইল পাথ।", 403);
    const data = await readFile(absolute);
    return new NextResponse(data, {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
