import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { featureTx, accessProgram, type Actor } from "@/lib/incubation/server";
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
      "ছবি/PDF দিন (সর্বোচ্চ ৮ MB)।",
    );
    const ext = path.extname(file.name).toLowerCase();
    insist(
      [".jpg", ".jpeg", ".png", ".webp", ".pdf"].includes(ext),
      "শুধু JPG, PNG, WebP ও PDF গ্রহণযোগ্য।",
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    insist(
      !verifyFileSignature(buffer, file.name),
      "ফাইলের ধরন ও বিষয়বস্তু মিলছে না।",
    );
    const result = await featureTx(actor, async (tx) => {
      const { member, program } = await accessProgram(tx, actor, programId);
      insist(!isProgramLocked(program.status), lockedMessage(program.status), 409);
      if (member)
        insist(member.teamId === teamId, "নিজের টিমের ফাইল দিন।", 403);
      if (teamId)
        insist(
          await tx.incubationTeam.findFirst({
            where: { id: teamId, programId },
          }),
          "টিম পাওয়া যায়নি।",
        );
      const relative = `incubation/${actor.courseId}/${programId}/${randomUUID()}${ext}`;
      const base = path.resolve(
        process.env.LOCAL_STORAGE_PATH ||
          process.env.UPLOAD_DIR ||
          path.join(process.cwd(), "storage"),
      );
      written = path.resolve(base, relative);
      insist(written.startsWith(base + path.sep), "অবৈধ ফাইল পাথ।");
      await mkdir(path.dirname(written), { recursive: true });
      await writeFile(written, buffer, { flag: "wx" });
      return tx.incubationAttachment.create({
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
    });
    return NextResponse.json({ id: result.id, name: result.name });
  } catch (e) {
    if (written) await unlink(written).catch(() => {});
    return failure(e);
  }
}
