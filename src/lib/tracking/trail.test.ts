import { describe, expect, it } from "vitest";
import { cleanTrail, distanceMeters, type RawFix } from "./trail";

// Near Dhaka. 0.0001° latitude ≈ 11.1 m; 0.0001° longitude ≈ 10.2 m here.
const BASE = { latitude: 23.81, longitude: 90.41 };
const T0 = Date.parse("2026-11-08T04:00:00Z");
const fix = (dLatM: number, dLngM: number, minute: number, accuracy = 15): RawFix => ({
  latitude: BASE.latitude + dLatM / 111_000,
  longitude: BASE.longitude + dLngM / 102_000,
  accuracy,
  capturedAt: new Date(T0 + minute * 60_000).toISOString(),
});

describe("distanceMeters", () => {
  it("is about 111 m per 0.001° of latitude", () => {
    const d = distanceMeters(BASE, { latitude: BASE.latitude + 0.001, longitude: BASE.longitude });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

describe("cleanTrail", () => {
  it("collapses GPS jitter while standing still into one point and one stop", () => {
    // 14 fixes wandering up to ~18 m around one spot, one per minute — the zig-zag "star".
    const jitter = [
      [0, 0], [12, -8], [-10, 15], [5, 18], [-15, -5], [8, -14], [-6, 9],
      [14, 4], [-12, -12], [3, -16], [-4, 13], [16, -2], [-9, 6], [2, 1],
    ];
    const t = cleanTrail(jitter.map(([a, b], i) => fix(a, b, i)));
    expect(t.rawCount).toBe(14);
    expect(t.path).toHaveLength(1);
    expect(t.stops).toHaveLength(1);
    expect(t.stops[0].minutes).toBe(13);
    expect(t.distanceMeters).toBe(0);
  });

  it("keeps real movement along a street", () => {
    // Walking ~80 m per minute in a straight line.
    const t = cleanTrail(Array.from({ length: 6 }, (_, i) => fix(i * 80, 0, i)));
    expect(t.path).toHaveLength(6);
    expect(t.stops).toHaveLength(0);
    expect(t.distanceMeters).toBeGreaterThan(380);
    expect(t.distanceMeters).toBeLessThan(420);
  });

  it("removes a single spike out and straight back", () => {
    const t = cleanTrail([fix(0, 0, 0), fix(2, 3, 1), fix(400, 300, 2), fix(-3, 2, 3), fix(1, -2, 4)]);
    expect(t.path).toHaveLength(1);
    expect(t.distanceMeters).toBe(0);
  });

  it("drops an impossible jump", () => {
    // 5 km in one minute is not walking or a rickshaw.
    const t = cleanTrail([fix(0, 0, 0), fix(100, 0, 1), fix(5000, 0, 2), fix(200, 0, 3)]);
    expect(t.path).toHaveLength(3);
    expect(t.distanceMeters).toBeLessThan(250);
  });

  it("drops inaccurate fixes but never empties the trail", () => {
    const t = cleanTrail([fix(0, 0, 0, 10), fix(300, 0, 1, 400), fix(5, 5, 2, 12)]);
    expect(t.droppedInaccurate).toBe(1);
    expect(t.path).toHaveLength(1);
    const onlyBad = cleanTrail([fix(0, 0, 0, 300), fix(50, 0, 1, 200)]);
    expect(onlyBad.path).toHaveLength(1);
    expect(onlyBad.path[0][0]).toBeCloseTo(BASE.latitude + 50 / 111_000, 6);
  });

  it("reports start, end and a stop between two walks", () => {
    const walkA = [0, 1, 2].map((i) => fix(i * 80, 0, i));
    const stay = Array.from({ length: 8 }, (_, i) => fix(160 + (i % 2 ? 6 : -6), (i % 3) * 5, 3 + i));
    const walkB = [11, 12].map((m, i) => fix(240 + i * 80, 0, m));
    const t = cleanTrail([...walkA, ...stay, ...walkB]);
    expect(t.stops).toHaveLength(1);
    expect(t.stops[0].minutes).toBeGreaterThanOrEqual(5);
    expect(t.start?.at).toBe(new Date(T0).toISOString());
    expect(t.end?.at).toBe(new Date(T0 + 12 * 60_000).toISOString());
  });

  it("handles empty input and missing accuracy", () => {
    expect(cleanTrail([]).path).toEqual([]);
    const t = cleanTrail([{ ...fix(0, 0, 0), accuracy: null }]);
    expect(t.path).toHaveLength(1);
  });
});
