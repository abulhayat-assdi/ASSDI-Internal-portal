import { describe, expect, it } from "vitest";
import { buildMonitor, issuesFor, shiftDay, type MonitorInput } from "./monitor";

const base = (over: Partial<MonitorInput> = {}): MonitorInput => ({
  today: "2026-11-10",
  program: {
    id: "p",
    status: "active",
    startDate: "2026-11-01",
    endDate: null,
    settings: { salesReminder: true, fgdEveryDays: null },
  },
  teams: [
    { id: "a", name: "Team A", active: true, members: [{ studentId: "s1", name: "Lead", isLead: true }] },
    { id: "b", name: "Team B", active: true, members: [{ studentId: "s2", name: "M", isLead: false }] },
    { id: "c", name: "Old", active: false, members: [] },
  ],
  sprints: [
    { teamId: "a", startDate: "2026-11-08", endDate: "2026-11-11" },
    { teamId: "b", startDate: "2026-11-08", endDate: "2026-11-11" },
  ],
  records: [{ teamId: "a", kind: "sale", status: "posted", date: "2026-11-09" }],
  sessions: [],
  pendingCorrections: 0,
  pendingFieldCorrections: 0,
  ...over,
});

const kinds = (input: MonitorInput) => buildMonitor(input).map((i) => `${i.kind}:${i.teamId ?? ""}`);

describe("buildMonitor", () => {
  it("flags missing leads and yesterday's missing sales, ignoring inactive teams", () => {
    expect(kinds(base()).sort()).toEqual(["missing_sales:b", "no_lead:b"]);
  });

  it("counts a pending late sale as reported and respects the reminder switch", () => {
    const pending = base({ records: [...base().records, { teamId: "b", kind: "sale", status: "pending", date: "2026-11-09" }] });
    expect(kinds(pending)).not.toContain("missing_sales:b");
    const off = base();
    off.program.settings.salesReminder = false;
    expect(kinds(off)).not.toContain("missing_sales:b");
  });

  it("does not chase reports before the program started or after it ended", () => {
    expect(kinds(base({ today: "2026-11-01" }))).not.toContain("missing_sales:b");
    const ended = base();
    ended.program.endDate = "2026-11-05";
    expect(kinds(ended)).toEqual(["no_lead:b"]);
  });

  it("flags teams without a sprint today", () => {
    expect(kinds(base({ sprints: [base().sprints[0]] }))).toContain("no_sprint:b");
  });

  it("flags FGD gaps only when configured", () => {
    const fgd = base({
      records: [
        ...base().records,
        { teamId: "a", kind: "fgd", status: "posted", date: "2026-11-08" },
        { teamId: "b", kind: "fgd", status: "posted", date: "2026-11-02" },
      ],
    });
    fgd.program.settings.fgdEveryDays = 3;
    expect(kinds(fgd)).toContain("missing_fgd:b");
    expect(kinds(fgd)).not.toContain("missing_fgd:a");
  });

  it("flags sessions left open from an earlier day, for the member, lead and staff", () => {
    const issues = buildMonitor(
      base({
        sessions: [
          { id: "x", teamId: "a", userId: "u1", userName: "Rahim", checkIn: "2026-11-09T05:00:00Z", checkOut: null },
          { id: "y", teamId: "a", userId: "u2", userName: "Karim", checkIn: "2026-11-10T03:00:00Z", checkOut: null },
        ],
      }),
    );
    const open = issues.filter((i) => i.kind === "open_session");
    expect(open.map((i) => i.userId)).toEqual(["u1"]);
    expect(issues[0].severity).toBe("high");
  });

  it("scopes the list per viewer", () => {
    const issues = buildMonitor(
      base({
        records: [
          ...base().records,
          { teamId: "b", targetTeamId: "a", kind: "transfer", status: "transfer_pending", date: "2026-11-10" },
        ],
        sessions: [
          { id: "x", teamId: "a", userId: "u1", userName: "Rahim", checkIn: "2026-11-09T05:00:00Z", checkOut: null },
        ],
        pendingCorrections: 2,
      }),
    );
    expect(issuesFor(issues, { staff: true })).toHaveLength(issues.length);
    expect(issuesFor(issues, { staff: false, teamId: "a", isLead: true, userId: "lead" }).map((i) => i.kind).sort()).toEqual([
      "open_session",
      "transfer_pending",
    ]);
    expect(issuesFor(issues, { staff: false, teamId: "a", isLead: false, userId: "u1" }).map((i) => i.kind)).toEqual([
      "open_session",
    ]);
    expect(issuesFor(issues, { staff: false, teamId: "a", isLead: false, userId: "u9" })).toEqual([]);
  });
});

it("shiftDay crosses month ends", () => {
  expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
});
