/**
 * "What needs attention" for one incubation program: missing daily reports,
 * sessions left open, people waiting for a decision. Pure function — the
 * overview shows it on screen and the daily reminder job turns it into
 * notifications, so both always agree.
 */
import { incubationState } from "./lifecycle";

export type Audience = "staff" | "lead" | "member";
export type Severity = "high" | "medium" | "low";

export interface MonitorIssue {
  /** Stable per day, so a reminder is never sent twice for the same thing. */
  key: string;
  kind:
    | "no_lead"
    | "no_sprint"
    | "missing_sales"
    | "missing_fgd"
    | "open_session"
    | "late_pending"
    | "transfer_pending"
    | "correction_pending";
  severity: Severity;
  audience: Audience[];
  teamId?: string;
  teamName?: string;
  userId?: string;
  count?: number;
  date?: string;
  text: string;
}

export interface MonitorInput {
  today: string;
  program: {
    id: string;
    status: string;
    startDate: string;
    endDate?: string | null;
    settings: { salesReminder?: boolean; fgdEveryDays?: number | null };
  };
  teams: {
    id: string;
    name: string;
    active: boolean;
    members: { studentId: string; name: string; isLead: boolean }[];
  }[];
  sprints: { teamId: string; startDate: string; endDate: string }[];
  records: {
    id?: string;
    teamId: string;
    targetTeamId?: string | null;
    kind: string;
    status: string;
    date: string;
  }[];
  sessions: {
    id: string;
    teamId: string;
    userId: string;
    userName: string;
    checkIn: Date | string;
    checkOut: Date | string | null;
  }[];
  pendingCorrections: number;
  pendingFieldCorrections: number;
}

export function dhakaDay(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(d));
}

export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function buildMonitor(input: MonitorInput): MonitorIssue[] {
  const { today, program } = input;
  const issues: MonitorIssue[] = [];
  const running = incubationState(program, today) === "running";
  const yesterday = shiftDay(today, -1);
  const teams = input.teams.filter((t) => t.active);
  const teamName = new Map(input.teams.map((t) => [t.id, t.name]));

  for (const team of teams) {
    const base = { teamId: team.id, teamName: team.name };
    if (!team.members.some((m) => m.isLead)) {
      issues.push({
        ...base,
        key: `no_lead:${team.id}`,
        kind: "no_lead",
        severity: "high",
        audience: ["staff"],
        text: `${team.name}: no team lead assigned — nobody can submit financial entries.`,
      });
    }
    if (!running) continue;
    if (!input.sprints.some((s) => s.teamId === team.id && s.startDate <= today && s.endDate >= today)) {
      issues.push({
        ...base,
        key: `no_sprint:${team.id}:${today}`,
        kind: "no_sprint",
        severity: "medium",
        audience: ["staff"],
        date: today,
        text: `${team.name}: no sprint/category assigned for today.`,
      });
    }
    if (program.settings.salesReminder !== false && yesterday >= program.startDate) {
      const reported = input.records.some(
        (r) =>
          r.teamId === team.id &&
          r.kind === "sale" &&
          r.date === yesterday &&
          (r.status === "posted" || r.status === "pending"),
      );
      if (!reported) {
        issues.push({
          ...base,
          key: `missing_sales:${team.id}:${yesterday}`,
          kind: "missing_sales",
          severity: "medium",
          audience: ["lead", "staff"],
          date: yesterday,
          text: `${team.name}: no sales entry for ${yesterday}. Submit it today, or tell your teacher if there were no sales.`,
        });
      }
    }
    const every = program.settings.fgdEveryDays;
    if (every && shiftDay(program.startDate, every) <= today) {
      const since = shiftDay(today, -every);
      const recent = input.records.some(
        (r) => r.teamId === team.id && r.kind === "fgd" && r.status === "posted" && r.date > since,
      );
      if (!recent) {
        issues.push({
          ...base,
          key: `missing_fgd:${team.id}:${today}`,
          kind: "missing_fgd",
          severity: "low",
          audience: ["lead", "staff"],
          date: today,
          text: `${team.name}: no FGD submitted in the last ${every} days.`,
        });
      }
    }
  }

  for (const s of input.sessions) {
    if (s.checkOut) continue;
    const day = dhakaDay(s.checkIn);
    if (day >= today) continue;
    issues.push({
      // Includes the day so the reminder repeats daily until the session is closed.
      key: `open_session:${s.id}:${today}`,
      kind: "open_session",
      severity: "high",
      audience: ["member", "lead", "staff"],
      teamId: s.teamId,
      teamName: teamName.get(s.teamId),
      userId: s.userId,
      date: day,
      text: `${s.userName}: field session from ${day} is not checked out yet.`,
    });
  }

  const late = input.records.filter((r) => r.status === "pending").length;
  if (late) {
    issues.push({
      key: `late_pending:${today}`,
      kind: "late_pending",
      severity: "medium",
      audience: ["staff"],
      count: late,
      text: `${late} late submission(s) pending approval.`,
    });
  }
  for (const r of input.records) {
    if (r.status !== "transfer_pending" || !r.targetTeamId) continue;
    issues.push({
      key: `transfer_pending:${r.id ?? `${r.targetTeamId}:${r.teamId}:${r.date}`}:${today}`,
      kind: "transfer_pending",
      severity: "medium",
      audience: ["lead", "staff"],
      teamId: r.targetTeamId,
      teamName: teamName.get(r.targetTeamId),
      date: r.date,
      text: `Transfer from ${teamName.get(r.teamId) ?? "another team"} waiting to be accepted (${r.date}).`,
    });
  }
  const corrections = input.pendingCorrections + input.pendingFieldCorrections;
  if (corrections) {
    issues.push({
      key: `correction_pending:${today}`,
      kind: "correction_pending",
      severity: "medium",
      audience: ["staff"],
      count: corrections,
      text: `${corrections} correction request(s) waiting for review.`,
    });
  }

  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** The part of the list one person should see. */
export function issuesFor(
  issues: MonitorIssue[],
  viewer: { staff: boolean; teamId?: string; isLead?: boolean; userId?: string },
): MonitorIssue[] {
  if (viewer.staff) return issues;
  return issues.filter((i) => {
    if (i.teamId !== viewer.teamId) return false;
    if (viewer.isLead && i.audience.includes("lead")) return true;
    return i.audience.includes("member") && i.userId === viewer.userId;
  });
}
