import { describe, expect, it } from "vitest";
import {
  batchAllowed,
  bearerToken,
  generateToken,
  hashToken,
  ingestSchema,
  ingestUrl,
  isCompetitionActive,
  isStale,
  newestSample,
  parseTrackingSettings,
  prepareSamples,
  requestOrigin,
  tokenExpiry,
  tokenMatches,
  tokenState,
  trackStatus,
  type Sample,
} from "./core";

const start = new Date("2026-11-08T08:00:00.000Z");
const at = (min: number) => new Date(start.getTime() + min * 60000);
const sample = (iso: string, extra: Partial<Sample> = {}): Sample => ({
  latitude: 23.8,
  longitude: 90.4,
  accuracy: 10,
  capturedAt: iso,
  ...extra,
});

describe("tokens", () => {
  it("is 32 random bytes in base64url and only the hash matches", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(generateToken()).not.toBe(t);
    const h = hashToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenMatches(t, h)).toBe(true);
    expect(tokenMatches(generateToken(), h)).toBe(false);
  });
  it("parses bearer headers strictly", () => {
    const t = generateToken();
    expect(bearerToken(`Bearer ${t}`)).toBe(t);
    expect(bearerToken(`bearer ${t}`)).toBeNull();
    expect(bearerToken("Bearer short")).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(`Basic ${t}`)).toBeNull();
  });
  it("expires 18 h after start and reports why it stopped", () => {
    expect(tokenExpiry(start).toISOString()).toBe("2026-11-09T02:00:00.000Z");
    const base = { endedAt: null, tokenRevokedAt: null, tokenExpiresAt: at(60) };
    expect(tokenState(base, at(1))).toBe("ok");
    expect(tokenState(base, at(60))).toBe("expired");
    expect(tokenState({ ...base, tokenRevokedAt: at(2) }, at(3))).toBe("revoked");
    expect(tokenState({ ...base, endedAt: at(2), tokenRevokedAt: at(2) }, at(3))).toBe("ended");
  });
});

describe("prepareSamples", () => {
  it("accepts old offline samples after start but drops those outside the ±2 min window", () => {
    const now = at(120);
    const r = prepareSamples(
      [
        sample(at(-3).toISOString()), // before start - 2 min
        sample(at(-1).toISOString()), // within skew
        sample(at(10).toISOString()), // old offline sample: fine
        sample(at(122.5).toISOString()), // beyond now + 2 min
        sample(at(121).toISOString()),
      ],
      start,
      now,
    );
    expect(r.outOfWindow).toBe(2);
    expect(r.samples.map((s) => s.capturedAt.getTime())).toEqual([
      at(-1).getTime(),
      at(10).getTime(),
      at(121).getTime(),
    ]);
  });
  it("dedupes equal instants written in different offsets and sorts", () => {
    const r = prepareSamples(
      [
        sample("2026-11-08T08:05:00.000Z", { battery: 80.6 }),
        sample("2026-11-08T14:05:00.000+06:00"),
        sample("2026-11-08T08:01:00Z", { speed: 1.5, bearing: 90 }),
      ],
      start,
      at(10),
    );
    expect(r.duplicates).toBe(1);
    expect(r.samples).toHaveLength(2);
    expect(r.samples[0]).toMatchObject({ speed: 1.5, bearing: 90, battery: null });
    expect(r.samples[1].battery).toBe(81);
  });
  it("picks the newest sample only if it advances the cached position", () => {
    const { samples } = prepareSamples(
      [sample(at(5).toISOString()), sample(at(7).toISOString())],
      start,
      at(10),
    );
    expect(newestSample(samples, null)?.capturedAt).toEqual(at(7));
    expect(newestSample(samples, at(6))?.capturedAt).toEqual(at(7));
    expect(newestSample(samples, at(8))).toBeNull();
    expect(newestSample([], null)).toBeNull();
  });
});

describe("ingest validation", () => {
  const ok = { trackId: "t1", positions: [sample(at(1).toISOString())] };
  it("accepts 1–500 valid samples", () => {
    expect(ingestSchema.parse(ok).positions).toHaveLength(1);
    expect(
      ingestSchema.safeParse({ ...ok, positions: Array(500).fill(ok.positions[0]) }).success,
    ).toBe(true);
    expect(ingestSchema.safeParse({ ...ok, positions: [] }).success).toBe(false);
    expect(
      ingestSchema.safeParse({ ...ok, positions: Array(501).fill(ok.positions[0]) }).success,
    ).toBe(false);
  });
  it("rejects bad coordinates, accuracy, battery and dates", () => {
    const bad = (p: Partial<Sample>) =>
      ingestSchema.safeParse({ trackId: "t", positions: [{ ...ok.positions[0], ...p }] }).success;
    expect(bad({ latitude: 91 })).toBe(false);
    expect(bad({ longitude: -181 })).toBe(false);
    expect(bad({ accuracy: -1 })).toBe(false);
    expect(bad({ battery: 101 })).toBe(false);
    expect(bad({ capturedAt: "yesterday" })).toBe(false);
    expect(bad({ speed: null, bearing: null, battery: null })).toBe(true);
  });
});

describe("live map status", () => {
  const t = { endedAt: null, startedAt: start, lastCapturedAt: at(10), intervalSeconds: 60 };
  it("is stale after more than 3 × interval without a fix", () => {
    expect(isStale(t, at(13))).toBe(false);
    expect(isStale(t, at(13.01))).toBe(true);
    expect(trackStatus(t, at(12))).toBe("fresh");
    expect(trackStatus(t, at(20))).toBe("stale");
  });
  it("counts from start when there is no fix yet, and ended tracks are never stale", () => {
    expect(isStale({ ...t, lastCapturedAt: null }, at(2))).toBe(false);
    expect(isStale({ ...t, lastCapturedAt: null }, at(4))).toBe(true);
    expect(isStale({ ...t, endedAt: at(11) }, at(100))).toBe(false);
    expect(trackStatus({ ...t, endedAt: at(11) }, at(100))).toBe("ended");
  });
});

describe("competition rules", () => {
  it("is active between start and end when switched on", () => {
    const c = { isActive: true, startDate: at(0), endDate: at(60) };
    expect(isCompetitionActive(c, at(30))).toBe(true);
    expect(isCompetitionActive(c, at(-1))).toBe(false);
    expect(isCompetitionActive(c, at(61))).toBe(false);
    expect(isCompetitionActive({ ...c, endDate: null }, at(9999))).toBe(true);
    expect(isCompetitionActive({ ...c, isActive: false }, at(30))).toBe(false);
  });
  it("treats a null batch as every batch", () => {
    expect(batchAllowed(null, "B1")).toBe(true);
    expect(batchAllowed("B1", "B1")).toBe(true);
    expect(batchAllowed("B1", "B2")).toBe(false);
    expect(batchAllowed("B1", undefined)).toBe(false);
  });
  it("validates staff tracking settings", () => {
    expect(parseTrackingSettings({})).toEqual({});
    expect(parseTrackingSettings({ trackingEnabled: true, trackingIntervalSeconds: "90" })).toEqual({
      trackingEnabled: true,
      trackingIntervalSeconds: 90,
    });
    expect(parseTrackingSettings({ trackingEnabled: "yes" }).trackingEnabled).toBe(false);
    expect(() => parseTrackingSettings({ trackingIntervalSeconds: 10 })).toThrow();
    expect(() => parseTrackingSettings({ trackingIntervalSeconds: 4000 })).toThrow();
  });
});

describe("urls", () => {
  it("builds the ingest URL from the proxied origin", () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(
      requestOrigin(h({ "x-forwarded-host": "demo.tasm-skill.asf.bd", "x-forwarded-proto": "https", host: "app:3000" })),
    ).toBe("https://demo.tasm-skill.asf.bd");
    expect(requestOrigin(h({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(requestOrigin(h({ host: "tasm-skill.asf.bd" }))).toBe("https://tasm-skill.asf.bd");
    expect(ingestUrl("https://x.tasm-skill.asf.bd/")).toBe("https://x.tasm-skill.asf.bd/api/tracking/ingest");
  });
});
