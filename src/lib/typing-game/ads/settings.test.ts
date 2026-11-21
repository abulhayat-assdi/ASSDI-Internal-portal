import { describe, expect, it } from "vitest";
import { ADS_OFF, displaySlot, parseAdSettings, viewsRequired } from "./settings";

const on = parseAdSettings({
  enabled: true,
  display_enabled: true,
  rewarded_enabled: true,
  publisher_id: "ca-pub-1234567890",
  slots: { lesson_left: { enabled: true, slotId: "111" }, result: { enabled: false, slotId: "222" } },
  action_views: { lesson_skip: 2, double_xp: 0, bogus: 5 },
  exempt_batch_ids: ["b-free"],
});

describe("ad settings", () => {
  it("ships off: every action is free and no slot renders", () => {
    expect(viewsRequired(ADS_OFF, "lesson_skip", [])).toBe(0);
    expect(displaySlot(ADS_OFF, "lesson_left", [])).toBeNull();
    expect(parseAdSettings(null)).toEqual(ADS_OFF);
  });
  it("uses the configured view counts when on", () => {
    expect(viewsRequired(on, "lesson_skip", ["b1"])).toBe(2);
    expect(viewsRequired(on, "double_xp", ["b1"])).toBe(0);
    expect(viewsRequired(on, "streak_restore", ["b1"])).toBe(0);
  });
  it("exempt batches never see ads", () => {
    expect(viewsRequired(on, "lesson_skip", ["b-free"])).toBe(0);
    expect(displaySlot(on, "lesson_left", ["b-free"])).toBeNull();
  });
  it("renders only enabled slots that have an id", () => {
    expect(displaySlot(on, "lesson_left", [])).toEqual({ publisherId: "ca-pub-1234567890", slotId: "111" });
    expect(displaySlot(on, "result", [])).toBeNull();
    expect(displaySlot(on, "top_banner", [])).toBeNull();
  });
  it("the master switch overrides everything", () => {
    const off = { ...on, enabled: false };
    expect(viewsRequired(off, "lesson_skip", [])).toBe(0);
    expect(displaySlot(off, "lesson_left", [])).toBeNull();
  });
});

import { sanitizeAdPatch } from "./patch";

describe("sanitizeAdPatch", () => {
  it("keeps known keys and drops unknown ones", () => {
    expect(sanitizeAdPatch({ enabled: true, hack: 1, rewarded_daily_limit: 5, no_fill: "block" })).toEqual({
      enabled: true,
      rewarded_daily_limit: 5,
      no_fill: "block",
    });
  });
  it("rejects a malformed publisher or slot id", () => {
    expect(sanitizeAdPatch({ publisher_id: "pub-123" })).toBeNull();
    expect(sanitizeAdPatch({ slots: { lesson_left: { enabled: true, slotId: "abc" } } })).toBeNull();
    expect(sanitizeAdPatch({ publisher_id: "ca-pub-1234567890" })).toEqual({ publisher_id: "ca-pub-1234567890" });
  });
  it("clamps view counts and filters batch ids", () => {
    expect(sanitizeAdPatch({ action_views: { lesson_skip: 3, double_xp: 99 }, exempt_batch_ids: ["x", "b286f1fe-4cda-4b4a-a8e8-dc33907a8fb7"] })).toEqual({
      action_views: { lesson_skip: 3 },
      exempt_batch_ids: ["b286f1fe-4cda-4b4a-a8e8-dc33907a8fb7"],
    });
  });
  it("rejects non-objects", () => {
    expect(sanitizeAdPatch(null)).toBeNull();
    expect(sanitizeAdPatch([1])).toBeNull();
  });
});
