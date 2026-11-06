import { it, expect } from "vitest";
import { incubationState } from "./lifecycle";
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
