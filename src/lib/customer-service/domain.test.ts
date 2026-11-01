import { describe, it, expect } from "vitest";
import {
  transition,
  canEdit,
  canRead,
  resolutionClass,
  resolutionMetrics,
  weekStart,
  dateRange,
  selectPolicy,
  csvCell,
  normalizeNumber,
  Workflow,
  Actor,
} from "./domain";
const agent: Actor = { id: "a", name: "Agent", role: "AGENT" },
  l2: Actor = { id: "b", name: "L2", role: "L2", teamId: "two" },
  l3: Actor = { id: "c", name: "L3", role: "L3", teamId: "three" };
const start = new Date("2026-10-31T17:59:00Z");
const fresh = (): Workflow => ({
  creatorId: "a",
  ownerId: "a",
  teamId: null,
  status: "PENDING",
  queue: "AGENT",
  returnState: "NORMAL",
  firstL2At: null,
  firstL3At: null,
  l2CompletedAt: null,
  l2DueAt: null,
  l3DueAt: null,
  resolvedAt: null,
  closedAt: null,
  resolverId: null,
  remarks: "",
  resolutionReason: "",
});
describe("Dhaka weekly reporting", () => {
  it("uses Sunday midnight, including a two-minute boundary crossing", () => {
    expect(resolutionClass(start, new Date("2026-10-31T18:01:00Z"))).toBe(
      "untethered",
    );
    expect(
      new Date(weekStart(new Date("2026-10-31T18:00:00Z"))).toISOString(),
    ).toBe("2026-10-31T18:00:00.000Z");
  });
  it("classifies different days in one week and across years", () => {
    expect(resolutionClass(new Date("2026-10-24T18:01:00Z"), start)).toBe(
      "tethered",
    );
    expect(
      resolutionClass(
        new Date("2026-12-31T18:01:00Z"),
        new Date("2027-01-02T17:59:00Z"),
      ),
    ).toBe("tethered");
    expect(resolutionClass(start, new Date("2026-11-08T00:00:00Z"))).toBe(
      "untethered",
    );
  });
  it("includes exact SLA deadline and continuous percentiles", () => {
    const r = resolutionMetrics(
      [1, 2, 3, 10].map((h) => ({
        createdAt: start,
        resolvedAt: new Date(+start + h * 3600000),
        dueAt: new Date(+start + 3 * 3600000),
      })),
    );
    expect(r.average).toBe(4 * 3600000);
    expect(r.median).toBe(2.5 * 3600000);
    expect(r.p90).toBeCloseTo(7.9 * 3600000);
    expect(r.withinSla).toBe(75);
    expect(r.tethered + r.untethered).toBe(r.resolved);
  });
  it("has N/A for empty cohorts and rejects impossible chronology", () => {
    expect(resolutionMetrics([]).average).toBeNull();
    expect(resolutionMetrics([]).withinSla).toBeNull();
    expect(() => resolutionClass(start, new Date(+start - 1))).toThrow();
  });
  it("uses inclusive local start and exclusive next local midnight", () => {
    const r = dateRange("2026-11-01", "2026-11-01");
    expect(r.start.toISOString()).toBe("2026-10-31T18:00:00.000Z");
    expect(+r.end - +r.start).toBe(86400000);
    expect(() => dateRange("2026-11-02", "2026-11-01")).toThrow();
  });
});
describe("ownership and workflow", () => {
  it("allows direct resolution and locks it afterwards", () => {
    const c = transition(fresh(), agent, "resolve", "Solved", start, {});
    expect(c.status).toBe("RESOLVED");
    expect(canEdit(agent, c)).toBe(false);
    expect(() => transition(c, agent, "progress", "", start, {})).toThrow();
  });
  it("keeps original L2 time and deadline through correction and resubmission", () => {
    let c = transition(
      fresh(),
      agent,
      "escalate",
      "Need help",
      start,
      { l2Minutes: 60 },
      "two",
    );
    const due = c.l2DueAt;
    c = transition(c, l2, "claim", "", new Date(+start + 1000), {});
    c = transition(
      c,
      l2,
      "agent_mistake",
      "Correct transaction",
      new Date(+start + 2000),
      {},
    );
    expect(canEdit(agent, c)).toBe(true);
    expect(() =>
      transition(c, agent, "resolve", "Solved", start, {}),
    ).toThrow();
    c = transition(
      c,
      agent,
      "resubmit",
      "Corrected",
      new Date(+start + 7200000),
      { l2Minutes: 60 },
      "two",
    );
    expect(c.firstL2At).toEqual(start);
    expect(c.l2DueAt).toEqual(due);
    c = transition(c, l2, "claim", "", start, {});
    c = transition(
      c,
      l2,
      "escalate",
      "L3 required",
      new Date(+start + 8000000),
      { l3Minutes: 30 },
      "three",
    );
    expect(c.l2CompletedAt).toEqual(c.firstL3At);
    c = transition(c, l3, "claim", "", start, {});
    expect(() =>
      transition(c, l3, "escalate", "L4", start, {}, "four"),
    ).toThrow();
  });
  it("rejects other agents, unclaimed work, wrong teams and missing remarks", () => {
    expect(() =>
      transition(
        fresh(),
        { ...agent, id: "other" },
        "resolve",
        "yes",
        start,
        {},
      ),
    ).toThrow();
    expect(() =>
      transition(fresh(), agent, "resolve", "", start, {}),
    ).toThrow();
    const c = transition(fresh(), agent, "escalate", "help", start, {}, "two");
    expect(canEdit(agent, c)).toBe(false);
    expect(canRead({ ...l2, teamId: "other" }, c)).toBe(false);
    expect(() => transition(c, l2, "resolve", "yes", start, {})).toThrow();
  });
  it("selects specific policies, preserves snapshots and fails missing or ambiguous policies", () => {
    const fallback = {
        active: true,
        complaintType: "",
        issueType: "",
        primaryTag: "",
      },
      generic = { ...fallback, complaintType: "c", issueType: "i" },
      specific = { ...generic, primaryTag: "t" };
    expect(selectPolicy([fallback, generic, specific], "c", "i", "t")).toBe(
      specific,
    );
    expect(selectPolicy([fallback, generic], "c", "i", "x")).toBe(generic);
    expect(() => selectPolicy([], "c", "i", "t")).toThrow();
    expect(() => selectPolicy([fallback, fallback], "c", "i", "t")).toThrow();
  });
  it("normalizes phones without losing zeros and protects CSV formulas", () => {
    expect(normalizeNumber("+880 (017)-00")).toBe("+88001700");
    expect(csvCell(" =SUM(A1)")).toBe('"\' =SUM(A1)"');
  });
});
