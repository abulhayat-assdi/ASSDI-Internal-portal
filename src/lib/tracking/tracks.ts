import "server-only";
// Creating and ending tracks. Kept free of incubation imports so the incubation
// code can call it inside its own transactions without an import cycle.
import type { FieldTrack, Prisma } from "@prisma/client";
import { generateToken, hashToken, ingestUrl, tokenExpiry } from "./core";
import { summarizeTrail } from "./trail";

type Tx = Prisma.TransactionClient;

export type TrackingConfig = {
  trackId: string;
  token: string;
  ingestUrl: string;
  intervalSeconds: number;
  expiresAt: string;
  title?: string;
};

export async function openTrack(
  tx: Tx,
  data: {
    courseId: string;
    competitionId: string;
    userId: string;
    userName: string;
    batchName: string | null;
    label: string | null;
    source: "competition" | "incubation";
    incubationSessionId?: string | null;
    intervalSeconds: number;
    now?: Date;
  },
): Promise<{ track: FieldTrack; token: string }> {
  const now = data.now || new Date();
  // Any other open track of the same user is closed first (one open track per user).
  await endTracks(tx, { userId: data.userId }, "replaced", now);
  const token = generateToken();
  const track = await tx.fieldTrack.create({
    data: {
      courseId: data.courseId,
      competitionId: data.competitionId,
      userId: data.userId,
      userName: data.userName,
      batchName: data.batchName,
      label: data.label,
      source: data.source,
      incubationSessionId: data.incubationSessionId || null,
      intervalSeconds: data.intervalSeconds,
      startedAt: now,
      tokenHash: hashToken(token),
      tokenExpiresAt: tokenExpiry(now),
    },
  });
  return { track, token };
}

/**
 * Ends every open track matching `where`, revokes its token and saves its walking
 * summary (distance, stops). Returns how many.
 */
export async function endTracks(
  tx: Tx,
  where: Prisma.FieldTrackWhereInput,
  reason: string,
  now = new Date(),
): Promise<number> {
  const open = await tx.fieldTrack.findMany({
    where: { ...where, endedAt: null },
    select: { id: true },
  });
  if (!open.length) return 0;
  const ids = open.map((t) => t.id);
  const r = await tx.fieldTrack.updateMany({
    where: { id: { in: ids }, endedAt: null },
    data: { endedAt: now, endReason: reason, tokenRevokedAt: now },
  });
  await summarizeTracks(tx, ids, now);
  return r.count;
}

/**
 * Recomputes and saves the walking summary of each track from its stored positions.
 */
export async function summarizeTracks(tx: Tx, ids: string[], now = new Date()) {
  for (const id of ids) {
    const positions = await tx.fieldTrackPosition.findMany({
      where: { trackId: id },
      orderBy: { capturedAt: "asc" },
      select: { latitude: true, longitude: true, accuracy: true, capturedAt: true },
    });
    const summary = summarizeTrail(
      positions.map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        accuracy: Number(p.accuracy),
        capturedAt: p.capturedAt,
      })),
    );
    await tx.fieldTrack.update({ where: { id }, data: { ...summary, summaryAt: now } });
  }
}

/** True when a track's saved summary is missing or older than its end. */
export function needsSummary(t: { endedAt: Date | null; summaryAt: Date | null }): boolean {
  if (!t.endedAt) return true;
  return !t.summaryAt || t.summaryAt.getTime() < t.endedAt.getTime();
}

export function trackingConfig(
  track: Pick<FieldTrack, "id" | "intervalSeconds" | "tokenExpiresAt">,
  token: string,
  origin: string,
  title?: string,
): TrackingConfig {
  return {
    trackId: track.id,
    token,
    ingestUrl: ingestUrl(origin),
    intervalSeconds: track.intervalSeconds,
    expiresAt: track.tokenExpiresAt.toISOString(),
    ...(title ? { title } : {}),
  };
}

export function publicTrack(t: FieldTrack) {
  return {
    id: t.id,
    competitionId: t.competitionId,
    source: t.source,
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    endReason: t.endReason,
    intervalSeconds: t.intervalSeconds,
    tokenExpiresAt: t.tokenExpiresAt,
  };
}

