import { it, expect } from "vitest";
import { checkTransition, incubationState, isProgramLocked } from "./lifecycle";
it("allows only listed status changes and requires reasons for reopening", () => {
  expect(checkTransition("draft", "active")).toBeNull();
  expect(checkTransition("active", "closing")).toBeNull();
  expect(checkTransition("closing", "closed")).toBeNull();
  expect(checkTransition("closed", "archived")).toBeNull();
  expect(checkTransition("draft", "archived")).toMatch(/সরাসরি/);
  expect(checkTransition("archived", "active")).toMatch(/সরাসরি/);
  expect(checkTransition("closed", "closing")).toMatch(/কারণ/);
  expect(checkTransition("closed", "closing", "missed sale")).toBeNull();
  expect(checkTransition("active", "cancelled", "")).toMatch(/কারণ/);
  expect(checkTransition("closed", "closed")).toBeNull();
  expect(["closed", "archived", "cancelled"].every(isProgramLocked)).toBe(true);
  expect(["draft", "active", "closing"].some(isProgramLocked)).toBe(false);
  expect(incubationState({ status: "cancelled", startDate: "2026-01-01" })).toBe("cancelled");
});
it("distinguishes scheduled, running, ended and explicit closed/draft programs by business date", () => {
  const p = {
    status: "active",
    startDate: "2026-11-06",
    endDate: "2026-11-08",
  };
  expect(incubationState(p, "2026-11-05")).toBe("scheduled");
  expect(incubationState(p, "2026-11-06")).toBe("running");
  expect(incubationState(p, "2026-11-08")).toBe("running");
  expect(incubationState(p, "2026-11-09")).toBe("ended");
  expect(incubationState({ ...p, status: "draft" }, "2026-11-06")).toBe(
    "draft",
  );
  expect(incubationState({ ...p, status: "closed" }, "2026-11-06")).toBe(
    "closed",
  );
});
