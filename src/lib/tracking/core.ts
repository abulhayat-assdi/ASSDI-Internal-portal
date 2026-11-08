// Pure field-tracking logic (no database, no Next.js) so it can be unit tested.
// Contract: docs/ANDROID_PORTAL_APP_PLAN.md.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const DEFAULT_INTERVAL_SECONDS = 60;
export const MIN_INTERVAL_SECONDS = 30;
export const MAX_INTERVAL_SECONDS = 3600;
/** Token lifetime when nothing else ends the track first. */
export const TOKEN_TTL_MS = 18 * 3600 * 1000;
/** Accepted capturedAt window around [track start, now]. */
export const SAMPLE_SKEW_MS = 2 * 60 * 1000;
/** Ended tracks stay on the live map this long. */
export const RECENT_ENDED_MS = 12 * 3600 * 1000;
/** A track is stale after this many intervals without a fix. */
export const STALE_INTERVALS = 3;
export const RETENTION_DAYS = 90;
export const INGEST_PATH = "/api/tracking/ingest";

// ---------- tokens ----------

/** 32 random bytes, base64url. Only the SHA-256 hash is ever stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex"),
    b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Extracts the bearer token; returns null for anything that cannot be one of ours. */
export function bearerToken(header: string | null | undefined): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})\s*$/.exec(header || "");
  return m ? m[1] : null;
}

export function tokenExpiry(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TOKEN_TTL_MS);
}

export type TokenTrack = {
  endedAt: Date | null;
  tokenRevokedAt: Date | null;
  tokenExpiresAt: Date;
};
/** "ok" when the app may keep sending; anything else answers 410 {stop:true}. */
export function tokenState(
  t: TokenTrack,
  now = new Date(),
): "ok" | "ended" | "revoked" | "expired" {
  if (t.endedAt) return "ended";
  if (t.tokenRevokedAt) return "revoked";
  if (t.tokenExpiresAt.getTime() <= now.getTime()) return "expired";
  return "ok";
}

// ---------- validation ----------

export const intervalSchema = z.coerce
  .number()
  .int()
  .min(MIN_INTERVAL_SECONDS)
  .max(MAX_INTERVAL_SECONDS);

/** Normalises the staff tracking settings; returns undefined fields when not sent. */
export function parseTrackingSettings(body: {
  trackingEnabled?: unknown;
  trackingIntervalSeconds?: unknown;
}): { trackingEnabled?: boolean; trackingIntervalSeconds?: number } {
  const out: { trackingEnabled?: boolean; trackingIntervalSeconds?: number } =
    {};
  if (body.trackingEnabled !== undefined)
    out.trackingEnabled = body.trackingEnabled === true;
  if (
    body.trackingIntervalSeconds !== undefined &&
    body.trackingIntervalSeconds !== null &&
    body.trackingIntervalSeconds !== ""
  )
    out.trackingIntervalSeconds = intervalSchema.parse(
      body.trackingIntervalSeconds,
    );
  return out;
}

export const sampleSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100000),
  capturedAt: z.string().datetime({ offset: true }),
  speed: z.number().finite().min(0).max(1000).nullish(),
  bearing: z.number().finite().min(0).max(360).nullish(),
  battery: z.number().min(0).max(100).nullish(),
});
export type Sample = z.infer<typeof sampleSchema>;

export const ingestSchema = z.object({
  trackId: z.string().min(1).max(100),
  positions: z.array(sampleSchema).min(1).max(500),
});

export type CleanSample = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: Date;
  speed: number | null;
  bearing: number | null;
  battery: number | null;
};

/**
 * Keeps samples captured between track start − 2 min and now + 2 min (old offline
 * samples are fine; there is no freshness rule here), drops duplicates of the same
 * capturedAt (millisecond precision, as stored), and sorts by time.
 * Returns the clean samples and how many were dropped as out-of-window or duplicate.
 */
export function prepareSamples(
  samples: Sample[],
  startedAt: Date,
  now = new Date(),
): { samples: CleanSample[]; outOfWindow: number; duplicates: number } {
  const from = startedAt.getTime() - SAMPLE_SKEW_MS,
    to = now.getTime() + SAMPLE_SKEW_MS;
  const seen = new Set<number>(),
    out: CleanSample[] = [];
  let outOfWindow = 0,
    duplicates = 0;
  for (const s of samples) {
    const at = Date.parse(s.capturedAt);
    if (!Number.isFinite(at) || at < from || at > to) {
      outOfWindow++;
      continue;
    }
    if (seen.has(at)) {
      duplicates++;
      continue;
    }
    seen.add(at);
    out.push({
      latitude: s.latitude,
      longitude: s.longitude,
      accuracy: s.accuracy,
      capturedAt: new Date(at),
      speed: s.speed ?? null,
      bearing: s.bearing ?? null,
      battery: s.battery == null ? null : Math.round(s.battery),
    });
  }
  out.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  return { samples: out, outOfWindow, duplicates };
}

/** The newest sample, if it is newer than what the track already shows. */
export function newestSample(
  samples: CleanSample[],
  lastCapturedAt: Date | null,
): CleanSample | null {
  const newest = samples.reduce<CleanSample | null>(
    (best, s) =>
      !best || s.capturedAt.getTime() > best.capturedAt.getTime() ? s : best,
    null,
  );
  if (!newest) return null;
  if (lastCapturedAt && newest.capturedAt.getTime() <= lastCapturedAt.getTime())
    return null;
  return newest;
}

// ---------- live map ----------

/** Stale = an open track with no fix for more than 3 × interval (counted from start when it never had one). */
export function isStale(
  t: {
    endedAt: Date | null;
    startedAt: Date;
    lastCapturedAt: Date | null;
    intervalSeconds: number;
  },
  now = new Date(),
): boolean {
  if (t.endedAt) return false;
  const since = (t.lastCapturedAt || t.startedAt).getTime();
  return now.getTime() - since > STALE_INTERVALS * t.intervalSeconds * 1000;
}

export function trackStatus(
  t: Parameters<typeof isStale>[0],
  now = new Date(),
): "fresh" | "stale" | "ended" {
  return t.endedAt ? "ended" : isStale(t, now) ? "stale" : "fresh";
}

// ---------- competition rules ----------

export function isCompetitionActive(
  c: { isActive: boolean; startDate: Date; endDate: Date | null },
  now = new Date(),
): boolean {
  return (
    c.isActive &&
    c.startDate.getTime() <= now.getTime() &&
    (!c.endDate || now.getTime() <= c.endDate.getTime())
  );
}

/** batchName null means every batch of the course. */
export function batchAllowed(
  competitionBatch: string | null,
  studentBatch: string | null | undefined,
): boolean {
  return competitionBatch === null || competitionBatch === (studentBatch ?? "");
}

export function ingestUrl(origin: string): string {
  return origin.replace(/\/+$/, "") + INGEST_PATH;
}

/** Public origin of the request as the browser/app sees it (proxy aware). */
export function requestOrigin(headers: {
  get(name: string): string | null;
}): string {
  const host =
    headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    headers.get("host") ||
    "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (/^(localhost|127\.|10\.|192\.168\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
