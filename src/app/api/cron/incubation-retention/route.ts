import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "",
    given = req.headers.get("x-cron-secret") || "";
  if (
    secret.length < 16 ||
    Buffer.byteLength(secret) !== Buffer.byteLength(given) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(given))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const removed = await withCourseContext(
      { courseId: null, isSuperAdmin: true },
      async (tx) => {
        const programs = await tx.incubationProgram.findMany({
          select: { id: true, settings: true },
        });
        let count = 0;
        for (const p of programs) {
          const days = (p.settings as { retentionDays?: number }).retentionDays;
          if (!days || days < 1 || days > 730) continue;
          const cutoff = new Date(Date.now() - days * 86400000);
          count += (
            await tx.incubationPosition.deleteMany({
              where: {
                session: { programId: p.id },
                capturedAt: { lt: cutoff },
              },
            })
          ).count;
          await tx.incubationFieldSession.updateMany({
            where: { programId: p.id, checkIn: { lt: cutoff } },
            data: { startPosition: Prisma.JsonNull },
          });
          await tx.incubationFieldSession.updateMany({
            where: { programId: p.id, checkOut: { lt: cutoff } },
            data: { endPosition: Prisma.JsonNull },
          });
        }
        return count;
      },
      { timeout: 60000 },
    );
    return NextResponse.json({ removed });
  } catch (e) {
    console.error("Incubation retention failed", e);
    return NextResponse.json(
      { error: "Retention cleanup failed" },
      { status: 500 },
    );
  }
}
