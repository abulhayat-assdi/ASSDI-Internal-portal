import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { featureTx, accessProgram, audit, type Actor } from "@/lib/incubation/server";
import { insist } from "@/lib/incubation/domain";
import { isProgramLocked, lockedMessage } from "@/lib/incubation/lifecycle";
import { failure } from "@/lib/incubation/http";
import { verifyFileSignature } from "@/lib/uploadGuard";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  let written: string | undefined;
  try {
    const a = await getSessionUser(req);
    insist(a?.courseId, "Unauthorized", 401);
    const actor = a as Actor;
    const form = await req.formData(),
      file = form.get("file"),
      programId = String(form.get("programId") || ""),
      teamId = String(form.get("teamId") || "") || null;
    insist(
      file instanceof File && file.size > 0 && file.size <= 8 * 1024 * 1024,
      "Upload an image or PDF (max 8 MB).",
    );
    const ext = path.extname(file.name).toLowerCase();
    insist(
      [".jpg", ".jpeg", ".png", ".webp", ".pdf"].includes(ext),
      "Only JPG, PNG, WebP and PDF files are accepted.",
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    insist(
      !verifyFileSignature(buffer, file.name),
      "The file type does not match its contents.",
    );
    const result = await featureTx(actor, async (tx) => {
      const { member, program } = await accessProgram(tx, actor, programId);
      insist(!isProgramLocked(program.status), lockedMessage(program.status), 409);
      if (member)
        insist(member.teamId === teamId, "Upload files for your own team only.", 403);
      if (teamId)
        insist(
          await tx.incubationTeam.findFirst({
            where: { id: teamId, programId },
          }),
          "Team not found.",
        );
      const relative = `incubation/${actor.courseId}/${programId}/${randomUUID()}${ext}`;
      const base = path.resolve(
        process.env.LOCAL_STORAGE_PATH ||
          process.env.UPLOAD_DIR ||
          path.join(process.cwd(), "storage"),
      );
      written = path.resolve(base, relative);
      insist(written.startsWith(base + path.sep), "Invalid file path.");
      await mkdir(path.dirname(written), { recursive: true });
      await writeFile(written, buffer, { flag: "wx" });
      const attachment = await tx.incubationAttachment.create({
        data: {
          courseId: actor.courseId,
          programId,
          teamId,
          uploadedBy: actor.id,
          name: file.name.slice(0, 255),
          mime:
            ext === ".pdf"
              ? "application/pdf"
              : ext === ".png"
                ? "image/png"
                : ext === ".webp"
                  ? "image/webp"
                  : "image/jpeg",
          size: file.size,
          path: relative,
        },
      });
      await audit(tx, actor, programId, "file.uploaded", attachment.id, null, {
        name: attachment.name,
        mime: attachment.mime,
        size: attachment.size,
        teamId,
      });
      return attachment;
    });
    return NextResponse.json({ id: result.id, name: result.name });
  } catch (e) {
    if (written) await unlink(written).catch(() => {});
    return failure(e);
  }
}
