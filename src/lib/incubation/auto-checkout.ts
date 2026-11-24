import "server-only";
// Automatic 23:00 (Asia/Dhaka) check-out of field sessions students forgot to end.
// Kept free of ./server imports so server.ts, field.ts and the tracking ingest can
// all call it inside their own transactions without an import cycle.
import { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { endTracks } from "@/lib/tracking/tracks";

type Tx = Prisma.TransactionClient;

/** Bangladesh has no daylight saving: Asia/Dhaka is always UTC+6. */
const DHAKA_OFFSET_MS = 6 * 3600000;
export const AUTO_CHECKOUT_HOUR = 23;
export const AUTO_CHECKOUT_ACTOR = { id: "system:auto_checkout", name: "Auto checkout (23:00)" };

/**
 * When a session that started at `checkIn` is closed automatically: 23:00 Dhaka on the
 * check-in day. A check-in at or after 23:00 would be closed at once, so it runs until
 * 23:00 of the next day instead.
 */
export function autoCheckoutAt(checkIn: Date): Date {
  const local = checkIn.getTime() + DHAKA_OFFSET_MS;
  const dayStart = Math.floor(local / 86400000) * 86400000;
  let cutoff = dayStart + AUTO_CHECKOUT_HOUR * 3600000;
  if (local >= cutoff) cutoff += 86400000;
  return new Date(cutoff - DHAKA_OFFSET_MS);
}

/** The session is due once its 23:00 cut-off has passed. */
export const isAutoCheckoutDue = (checkIn: Date, now = new Date()) =>
  autoCheckoutAt(checkIn).getTime() <= now.getTime();

const maxFieldHours = (settings: unknown) => {
  const v = (settings as { maxFieldHours?: unknown } | null)?.maxFieldHours;
  return typeof v === "number" && v > 0 ? v : null;
};

export type AutoClosed = { id: string; userId: string; programId: string; checkOut: Date; overLimit: boolean };

/**
 * Closes every open session matching `where` whose 23:00 cut-off has passed, stamping
 * checkOut = that 23:00 (not "now"), so a late cron run or a lazy close on the next
 * request stores the same time. Race-safe: the update only applies while checkOut is
 * still null, so a concurrent manual check-out or another run simply wins.
 */
export async function autoCheckoutStale(
  tx: Tx,
  where: Prisma.IncubationFieldSessionWhereInput = {},
  now = new Date(),
): Promise<AutoClosed[]> {
  const open = await tx.incubationFieldSession.findMany({
    where: { ...where, checkOut: null, checkIn: { lte: now } },
    include: { program: { select: { settings: true } } },
    orderBy: { checkIn: "asc" },
  });
  const closed: AutoClosed[] = [];
  for (const session of open) {
    if (!isAutoCheckoutDue(session.checkIn, now)) continue;
    const at = autoCheckoutAt(session.checkIn);
    const r = await tx.incubationFieldSession.updateMany({
      where: { id: session.id, checkOut: null, version: session.version },
      data: {
        checkOut: at,
        endAreaId: session.endAreaId ?? session.startAreaId,
        autoCheckout: true,
        version: { increment: 1 },
      },
    });
    if (!r.count) continue;
    await endTracks(tx, { incubationSessionId: session.id }, "auto_checkout", at);
    // Same rule as a manual check-out: field time over the configured cap is recorded
    // as an audited exception for review; the time itself still counts up to 23:00.
    const cap = maxFieldHours(session.program?.settings);
    const overLimit = cap !== null && (at.getTime() - session.checkIn.getTime()) / 3600000 > cap;
    await tx.incubationAudit.create({
      data: {
        courseId: session.courseId,
        programId: session.programId,
        action: "field.auto_checkout",
        entityId: session.id,
        actorId: AUTO_CHECKOUT_ACTOR.id,
        actorName: AUTO_CHECKOUT_ACTOR.name,
        before: { id: session.id, checkIn: session.checkIn.toISOString(), checkOut: null },
        after: {
          id: session.id,
          userId: session.userId,
          userName: session.userName,
          checkIn: session.checkIn.toISOString(),
          checkOut: at.toISOString(),
          autoCheckout: true,
          overLimit,
        },
        reason: overLimit
          ? "Automatic check-out at 23:00 (Asia/Dhaka); configured field duration exceeded, review required."
          : "Automatic check-out at 23:00 (Asia/Dhaka); the student did not check out.",
      },
    });
    closed.push({ id: session.id, userId: session.userId, programId: session.programId, checkOut: at, overLimit });
  }
  return closed;
}

/** Scheduled run (cron route): every course, every program. Safe to repeat. */
export async function runAutoCheckout(now = new Date()) {
  const closed = await withCourseContext(
    { courseId: null, isSuperAdmin: true },
    (tx) => autoCheckoutStale(tx, {}, now),
    { timeout: 60000 },
  );
  return { closed: closed.length, overLimit: closed.filter((c) => c.overLimit).length };
}
