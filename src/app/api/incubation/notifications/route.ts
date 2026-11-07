import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { featureTx, type Actor } from "@/lib/incubation/server";
import { failure } from "@/lib/incubation/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The signed-in person's own incubation reminders (newest 50) and unread count. */
export async function GET(req: NextRequest) {
  try {
    const actor = await getSessionUser(req);
    if (!actor?.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const programId = req.nextUrl.searchParams.get("programId") || undefined;
    const where = { userId: actor.id, ...(programId ? { programId } : {}) };
    const [items, unread] = await featureTx(actor as Actor, (tx) =>
      Promise.all([
        tx.incubationNotification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, programId: true, kind: true, title: true, body: true, link: true, createdAt: true, readAt: true },
        }),
        tx.incubationNotification.count({ where: { ...where, readAt: null } }),
      ]),
    );
    return NextResponse.json({ items, unread });
  } catch (e) {
    return failure(e);
  }
}

/** Marks the given (or all) of the caller's reminders as read. */
export async function POST(req: NextRequest) {
  try {
    const actor = await getSessionUser(req);
    if (!actor?.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = z
      .object({ ids: z.array(z.string()).max(200).optional(), programId: z.string().optional() })
      .parse(await req.json());
    const updated = await featureTx(actor as Actor, (tx) =>
      tx.incubationNotification.updateMany({
        where: {
          userId: actor.id,
          readAt: null,
          ...(body.ids ? { id: { in: body.ids } } : {}),
          ...(body.programId ? { programId: body.programId } : {}),
        },
        data: { readAt: new Date() },
      }),
    );
    return NextResponse.json({ updated: updated.count });
  } catch (e) {
    return failure(e);
  }
}
