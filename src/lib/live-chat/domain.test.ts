import { describe, it, expect } from "vitest";
import {
  defaults,
  settingsSchema,
  metrics,
  scoreEvaluation,
  businessOpen,
  rubric,
} from "./domain";
describe("Live Chat reporting and policy", () => {
  it("rejects misleading resolution, capacity and timeout settings", () => {
    expect(settingsSchema.safeParse({ capacity: 0 }).success).toBe(false);
    expect(
      settingsSchema.safeParse({ warningSeconds: 600, closeSeconds: 300 })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ timezone: "invalid/timezone" }).success,
    ).toBe(false);
  });
  it("measures FRT from queue entry, excludes unresolved ART and includes abandonment in service level", () => {
    const start = new Date("2026-11-05T03:00:00Z");
    const row = {
      createdAt: start,
      queueAt: start,
      acceptedAt: new Date(+start + 10000),
      firstReplyAt: new Date(+start + 30000),
      resolvedAt: new Date(+start + 120000),
      serviceSeconds: 60,
      status: "RESOLVED",
    };
    const v = metrics([
      row,
      { ...row, firstReplyAt: null, resolvedAt: null, status: "ABANDONED" },
      { ...row, resolvedAt: null, status: "ACTIVE" },
    ]);
    expect(v.frt).toBe(30);
    expect(v.art).toBe(120);
    expect(v.queueWait).toBe(10);
    expect(v.resolved).toBe(1);
    expect(v.serviceLevel).toBeCloseTo(200 / 3);
    expect(v.abandonmentRate).toBeCloseTo(100 / 3);
  });
  it("scores a balanced rubric and rejects missing or fabricated scores", () => {
    expect(
      scoreEvaluation(Object.fromEntries(rubric.map((r) => [r.key, r.max]))),
    ).toBe(100);
    expect(() => scoreEvaluation({ accuracy: 999 })).toThrow();
    expect(() =>
      scoreEvaluation({
        ...Object.fromEntries(rubric.map((r) => [r.key, r.max])),
        speed: 100,
      }),
    ).toThrow();
  });
  it("evaluates business hours in configured local timezone", () => {
    const cfg = {
      ...defaults,
      businessHours: { enabled: true, start: 9, end: 18, days: [4] },
    };
    expect(businessOpen(cfg, new Date("2026-11-05T03:00:00Z"))).toBe(true);
    expect(businessOpen(cfg, new Date("2026-11-05T14:00:00Z"))).toBe(false);
  });
});
