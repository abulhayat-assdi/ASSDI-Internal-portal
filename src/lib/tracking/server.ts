import "server-only";
import { Prisma } from "@prisma/client";
import type { JWTPayload } from "@/lib/auth";
import { canManageCompetitions } from "@/lib/auth";
import { withCourseContext } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features";
import { resolveStudent, resolveTeam } from "@/lib/competitionServer";
import { insist, IncubationError } from "@/lib/incubation/domain";
import { isSupervisor } from "@/lib/incubation/server";
import {
  endTracks,
  openTrack,
  publicTrack,
  trackingConfig,
} from "./tracks";
import {
  DEFAULT_INTERVAL_SECONDS,
  RECENT_ENDED_MS,
  RETENTION_DAYS,
  batchAllowed,
  generateToken,
  hashToken,
  ingestSchema,
  isCompetitionActive,
  isStale,
  newestSample,
  prepareSamples,
  tokenState,
  trackStatus,
} from "./core";

type Tx = Prisma.TransactionClient;
export type TrackingActor = JWTPayload & { courseId: string };

/** Thrown for 410 {stop:true}: the app must stop its service. */
export class TrackGoneError extends IncubationError {
  constructor(public reason: string) {
    super("Tracking has ended.", 410);
  }
}

const ctx = (courseId: string) => ({ courseId, isSuperAdmin: false });
const num = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));

// ---------- student: start / stop / resume ----------

async function loadStartableCompetition(
  tx: Tx,
  actor: TrackingActor,
  competitionId: string,
) {
  const competition = await tx.competition.findUnique({
    where: { id: competitionId, courseId: actor.courseId },
  });
  insist(competition, "Competition not found.", 404);
  insist(
    competition.kind !== "business_incubation",
    "Use field check-in.",
    409,
  );
  const course = await tx.course.findUnique({
    where: { id: actor.courseId },
    select: { settings: true },
  });
  insist(
    isFeatureEnabled(course?.settings, "competitions"),
    "Competitions are not enabled for this course.",
    403,
  );
  insist(
    competition.trackingEnabled,
    "Location tracking is off for this competition.",
    409,
  );
  insist(
    isCompetitionActive(competition),
    "This competition is not running.",
    409,
  );
  const student = await resolveStudent(tx, actor, actor.courseId);
  insist(student, "Student profile not found.", 403);
  insist(
    batchAllowed(competition.batchName, student.batchName),
    "This competition is not for your batch.",
    403,
  );
  return { competition, student };
}

export async function startCompetitionTrack(
  actor: TrackingActor,
  competitionId: string,
  origin: string,
) {
  insist(actor.role === "student", "Only students can start tracking.", 403);
  return withCourseContext(ctx(actor.courseId), async (tx) => {
    const { competition, student } = await loadStartableCompetition(
      tx,
      actor,
      competitionId,
    );
    const { group } = await resolveTeam(tx, actor.courseId, student);
    const { track, token } = await openTrack(tx, {
      courseId: actor.courseId,
      competitionId: competition.id,
      userId: actor.id,
      userName: student.name || actor.displayName,
      batchName: student.batchName,
      label: group?.groupName || null,
      source: "competition",
      intervalSeconds:
        competition.trackingIntervalSeconds || DEFAULT_INTERVAL_SECONDS,
    });
    const cfg = trackingConfig(track, token, origin, competition.title);
    return {
      track: publicTrack(track),
      token,
      ingestUrl: cfg.ingestUrl,
      intervalSeconds: cfg.intervalSeconds,
      expiresAt: cfg.expiresAt,
      title: competition.title,
    };
  });
}

/**
 * Issues a fresh token for the student's own open track (for example after the app
 * was reinstalled or the session was started from a browser). The old token stops working.
 */
export async function resumeTrack(
  actor: TrackingActor,
  target: { trackId?: string; incubationSessionId?: string },
  origin: string,
) {
  insist(target.trackId || target.incubationSessionId, "trackId is required.");
  insist(actor.role === "student", "Only students can resume tracking.", 403);
  return withCourseContext(ctx(actor.courseId), async (tx) => {
    const track = await tx.fieldTrack.findFirst({
      where: target.trackId
        ? { id: target.trackId, userId: actor.id }
        : {
            incubationSessionId: target.incubationSessionId,
            userId: actor.id,
            endedAt: null,
          },
      include: { competition: { select: { title: true } } },
    });
    insist(track, "Track not found.", 404);
    insist(
      tokenState({ ...track, tokenRevokedAt: null }) === "ok",
      "This tracking session has ended.",
      410,
    );
    const token = generateToken();
    const updated = await tx.fieldTrack.update({
      where: { id: track.id },
      data: { tokenHash: hashToken(token), tokenRevokedAt: null },
    });
    const cfg = trackingConfig(updated, token, origin, track.competition.title);
    return {
      track: publicTrack(updated),
      token,
      ingestUrl: cfg.ingestUrl,
      intervalSeconds: cfg.intervalSeconds,
      expiresAt: cfg.expiresAt,
      title: track.competition.title,
    };
  });
}

async function canWatchCompetition(
  tx: Tx,
  actor: TrackingActor,
  competitionId: string,
) {
  if (actor.role === "student") return false;
  if (canManageCompetitions(actor) || isSupervisor(actor)) return true;
  const program = await tx.incubationProgram.findFirst({
    where: { competitionId, deletedAt: null },
    select: { staffIds: true },
  });
  return !!program && (program.staffIds as string[]).includes(actor.id);
}

export async function stopTrack(actor: TrackingActor, trackId: string) {
  return withCourseContext(ctx(actor.courseId), async (tx) => {
    const track = await tx.fieldTrack.findFirst({ where: { id: trackId } });
    insist(track, "Track not found.", 404);
    insist(
      track.userId === actor.id ||
        (await canWatchCompetition(tx, actor, track.competitionId)),
      "You cannot stop this track.",
      403,
    );
    const reason = track.userId === actor.id ? "stopped" : "stopped_by_staff";
    await endTracks(tx, { id: track.id }, reason);
    const after = await tx.fieldTrack.findUniqueOrThrow({
      where: { id: track.id },
    });
    return { track: publicTrack(after) };
  });
}

/** Tracking info for the student competition page (resume after reload). */
export async function studentTrackingInfo(
  tx: Tx,
  competition: {
    id: string;
    trackingEnabled: boolean;
    trackingIntervalSeconds: number;
  },
  userId: string,
) {
  const open = await tx.fieldTrack.findFirst({
    where: { competitionId: competition.id, userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  return {
    enabled: competition.trackingEnabled,
    intervalSeconds: competition.trackingIntervalSeconds,
    openTrack:
      open && tokenState({ ...open, tokenRevokedAt: null }) === "ok"
        ? publicTrack(open)
        : null,
  };
}

// ---------- ingest (bearer token, no cookie) ----------

export async function ingest(token: string | null, input: unknown) {
  insist(token, "Missing or invalid token.", 401);
  const body = ingestSchema.parse(input);
  const hash = hashToken(token);
  // The only cross-course read: find which course the token belongs to.
  const found = await withCourseContext(
    { courseId: null, isSuperAdmin: true },
    (tx) =>
      tx.fieldTrack.findUnique({
        where: { tokenHash: hash },
        select: { id: true, courseId: true },
      }),
  );
  insist(found && found.id === body.trackId, "Invalid token.", 401);
  const result = await withCourseContext(ctx(found.courseId), async (tx) => {
    // Lock the row so concurrent batches update the cached last position in order.
    await tx.$queryRaw`SELECT id FROM field_tracks WHERE id=${found.id} FOR UPDATE`;
    const track = await tx.fieldTrack.findUniqueOrThrow({
      where: { id: found.id },
    });
    const now = new Date();
    const state = tokenState(track, now);
    if (state === "expired")
      await endTracks(tx, { id: track.id }, "expired", now);
    // Return instead of throwing so the "expired" close above is committed.
    if (state !== "ok") return { gone: state } as const;

    const prepared = prepareSamples(body.positions, track.startedAt, now);
    let accepted = 0;
    if (prepared.samples.length) {
      accepted = (
        await tx.fieldTrackPosition.createMany({
          data: prepared.samples.map((s) => ({
            courseId: track.courseId,
            trackId: track.id,
            receivedAt: now,
            ...s,
          })),
          skipDuplicates: true,
        })
      ).count;
      if (track.incubationSessionId)
        await tx.incubationPosition.createMany({
          data: prepared.samples.map((s) => ({
            courseId: track.courseId,
            sessionId: track.incubationSessionId!,
            capturedAt: s.capturedAt,
            receivedAt: now,
            latitude: s.latitude,
            longitude: s.longitude,
            accuracy: s.accuracy,
          })),
          skipDuplicates: true,
        });
      const newest = newestSample(prepared.samples, track.lastCapturedAt);
      await tx.fieldTrack.update({
        where: { id: track.id },
        data: newest
          ? {
              lastLatitude: newest.latitude,
              lastLongitude: newest.longitude,
              lastAccuracy: newest.accuracy,
              lastCapturedAt: newest.capturedAt,
              lastReceivedAt: now,
              lastBattery: newest.battery ?? track.lastBattery,
            }
          : { lastReceivedAt: now },
      });
    }
    return {
      accepted,
      duplicates:
        prepared.duplicates + (prepared.samples.length - accepted),
      rejected: prepared.outOfWindow,
    };
  });
  if ("gone" in result && result.gone) throw new TrackGoneError(result.gone);
  return result;
}

// ---------- staff: live map and trails ----------

export async function liveTracks(actor: TrackingActor, competitionId: string) {
  return withCourseContext(ctx(actor.courseId), async (tx) => {
    const competition = await tx.competition.findUnique({
      where: { id: competitionId, courseId: actor.courseId },
      select: {
        id: true,
        title: true,
        kind: true,
        trackingEnabled: true,
        trackingIntervalSeconds: true,
      },
    });
    insist(competition, "Competition not found.", 404);
    insist(
      await canWatchCompetition(tx, actor, competition.id),
      "You do not have permission to watch this competition.",
      403,
    );
    const now = new Date();
    await endTracks(
      tx,
      { competitionId: competition.id, tokenExpiresAt: { lte: now } },
      "expired",
      now,
    );
    const tracks = await tx.fieldTrack.findMany({
      where: {
        competitionId: competition.id,
        OR: [
          { endedAt: null },
          { endedAt: { gte: new Date(now.getTime() - RECENT_ENDED_MS) } },
        ],
      },
      orderBy: [{ endedAt: { sort: "desc", nulls: "first" } }, { userName: "asc" }],
    });
    return {
      competition: {
        ...competition,
        intervalSeconds:
          competition.kind === "business_incubation"
            ? DEFAULT_INTERVAL_SECONDS
            : competition.trackingIntervalSeconds,
      },
      now: now.toISOString(),
      tracks: tracks.map((t) => ({
        id: t.id,
        userId: t.userId,
        userName: t.userName,
        batchName: t.batchName,
        label: t.label,
        source: t.source,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        endReason: t.endReason,
        intervalSeconds: t.intervalSeconds,
        lastPosition:
          t.lastLatitude !== null && t.lastLongitude !== null
            ? {
                latitude: num(t.lastLatitude),
                longitude: num(t.lastLongitude),
                accuracy: num(t.lastAccuracy),
                capturedAt: t.lastCapturedAt,
              }
            : null,
        receivedAt: t.lastReceivedAt,
        battery: t.lastBattery,
        stale: isStale(t, now),
        status: trackStatus(t, now),
      })),
    };
  });
}

const TRAIL_LIMIT = 5000;
export async function trackPositions(actor: TrackingActor, trackId: string) {
  return withCourseContext(ctx(actor.courseId), async (tx) => {
    const track = await tx.fieldTrack.findFirst({ where: { id: trackId } });
    insist(track, "Track not found.", 404);
    insist(
      track.userId === actor.id ||
        (await canWatchCompetition(tx, actor, track.competitionId)),
      "You cannot view this track.",
      403,
    );
    const rows = await tx.fieldTrackPosition.findMany({
      where: { trackId: track.id },
      orderBy: { capturedAt: "desc" },
      take: TRAIL_LIMIT,
    });
    rows.reverse();
    return {
      track: publicTrack(track),
      truncated: rows.length === TRAIL_LIMIT,
      positions: rows.map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        accuracy: Number(p.accuracy),
        capturedAt: p.capturedAt,
        speed: p.speed,
        bearing: p.bearing,
        battery: p.battery,
      })),
    };
  });
}

// ---------- retention ----------

/** Deletes field_track_positions older than 90 days in every course. Caller supplies a super-admin tx. */
export async function purgeOldPositions(tx: Tx, now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86400000);
  return (
    await tx.fieldTrackPosition.deleteMany({
      where: { capturedAt: { lt: cutoff } },
    })
  ).count;
}
