export type Role = "AGENT" | "L2" | "L3" | "SUPERVISOR" | "ADMIN";
export type Actor = {
  id: string;
  name: string;
  role: Role;
  teamId?: string | null;
};
export type Workflow = {
  creatorId: string;
  ownerId: string | null;
  teamId: string | null;
  status: string;
  queue: string;
  returnState: string;
  firstL2At: Date | null;
  firstL3At: Date | null;
  l2CompletedAt: Date | null;
  l2DueAt: Date | null;
  l3DueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  resolverId: string | null;
  remarks: string;
  resolutionReason: string;
};
export class DomainError extends Error {}
export const supervisor = (a: Actor) =>
  a.role === "ADMIN" || a.role === "SUPERVISOR";
export const normalizeNumber = (n: string) => n.replace(/[\s().-]/g, "");
export function canRead(a: Actor, c: Pick<Workflow, "queue" | "teamId">) {
  return (
    supervisor(a) ||
    a.role === "AGENT" ||
    (a.role === c.queue && !!a.teamId && a.teamId === c.teamId)
  );
}
export function canEdit(a: Actor, c: Workflow) {
  return (
    supervisor(a) ||
    (c.status !== "RESOLVED" &&
      c.status !== "INVALID" &&
      c.queue === "AGENT" &&
      a.role === "AGENT" &&
      c.ownerId === a.id)
  );
}
export function transition(
  c: Workflow,
  a: Actor,
  action: string,
  remark: string,
  now: Date,
  policy: { l2Minutes?: number | null; l3Minutes?: number | null },
  teamId?: string,
  returnOwnerId?: string | null,
) {
  const next: Workflow = {
    creatorId: c.creatorId,
    ownerId: c.ownerId,
    teamId: c.teamId,
    status: c.status,
    queue: c.queue,
    returnState: c.returnState,
    firstL2At: c.firstL2At,
    firstL3At: c.firstL3At,
    l2CompletedAt: c.l2CompletedAt,
    l2DueAt: c.l2DueAt,
    l3DueAt: c.l3DueAt,
    resolvedAt: c.resolvedAt,
    closedAt: c.closedAt,
    resolverId: c.resolverId,
    remarks: c.remarks,
    resolutionReason: c.resolutionReason,
  };
  const staff = supervisor(a);
  if (c.status === "RESOLVED" || c.status === "INVALID")
    throw new DomainError("Closed complaints cannot change workflow");
  if (!canRead(a, c))
    throw new DomainError("This complaint is outside your queue");
  if (action === "claim") {
    if (!staff && (a.role === "AGENT" || c.queue !== a.role || c.ownerId))
      throw new DomainError("This queue item cannot be claimed");
    next.ownerId = a.id;
    next.status = "IN_PROGRESS";
    return next;
  }
  if (!staff && c.ownerId !== a.id)
    throw new DomainError("Claim this complaint before acting");
  if (!staff && c.queue !== a.role)
    throw new DomainError("Complaint belongs to another queue");
  if (action === "progress") {
    next.status = "IN_PROGRESS";
    return next;
  }
  if (!remark.trim())
    throw new DomainError("A reason or solution remark is required");
  next.remarks = remark;
  if (action === "resolve") {
    if (c.queue === "AGENT" && c.firstL2At)
      throw new DomainError("Returned complaints must be resubmitted to L2");
    next.status = "RESOLVED";
    next.resolvedAt = now;
    next.closedAt = now;
    next.resolverId = a.id;
    if (c.queue === "L2") next.l2CompletedAt = now;
  } else if (action === "invalid") {
    if (c.queue === "AGENT")
      throw new DomainError("Only escalation teams may mark invalid");
    next.status = "INVALID";
    next.closedAt = now;
    if (c.queue === "L2") next.l2CompletedAt = now;
  } else if (action === "revert" || action === "agent_mistake") {
    if (c.queue !== "L2")
      throw new DomainError("Only L2 can return a complaint");
    next.queue = "AGENT";
    next.ownerId = returnOwnerId === undefined ? c.creatorId : returnOwnerId;
    next.returnState =
      action === "agent_mistake" ? "AGENT_MISTAKE" : "REVERTED";
    next.status = "PENDING";
  } else if (action === "escalate" || action === "resubmit") {
    if (c.queue === "L3")
      throw new DomainError("There is no escalation beyond L3");
    if (!teamId) throw new DomainError("Select an eligible destination team");
    if (action === "resubmit" && !(c.queue === "AGENT" && c.firstL2At))
      throw new DomainError("Complaint has not been returned");
    if (c.queue === "AGENT") {
      next.queue = "L2";
      next.firstL2At = c.firstL2At ?? now;
      next.l2DueAt =
        c.l2DueAt ??
        (policy.l2Minutes
          ? new Date(next.firstL2At.getTime() + policy.l2Minutes * 60000)
          : null);
      next.returnState = c.firstL2At ? "RESUBMITTED" : "NORMAL";
    } else {
      next.queue = "L3";
      next.firstL3At = c.firstL3At ?? now;
      next.l2CompletedAt = now;
      next.l3DueAt =
        c.l3DueAt ??
        (policy.l3Minutes
          ? new Date(next.firstL3At.getTime() + policy.l3Minutes * 60000)
          : null);
      next.returnState = "RE_ESCALATED";
    }
    next.teamId = teamId;
    next.ownerId = null;
    next.status = "PENDING";
  } else throw new DomainError("Unknown workflow action");
  return next;
}
// Bangladesh has UTC+06:00 throughout the operational reporting period.
const DAY = 86400000,
  OFFSET = 6 * 3600000;
export function weekStart(d: Date) {
  const local = new Date(d.getTime() + OFFSET);
  return (
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - local.getUTCDay(),
    ) - OFFSET
  );
}
export function resolutionClass(created: Date, resolved: Date) {
  if (resolved < created) throw new DomainError("Resolution predates creation");
  return weekStart(created) === weekStart(resolved) ? "tethered" : "untethered";
}
export function localDate(d: Date) {
  return new Date(d.getTime() + OFFSET).toISOString().slice(0, 10);
}
export function dateRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    throw new DomainError("Choose valid dates");
  const start = new Date(from + "T00:00:00+06:00");
  const end = new Date(new Date(to + "T00:00:00+06:00").getTime() + DAY);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    localDate(start) !== from ||
    localDate(new Date(+end - DAY)) !== to ||
    end <= start ||
    +end - +start > 366 * DAY
  )
    throw new DomainError("Choose a date range of at most 366 days");
  return { start, end };
}
export function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    i = (sorted.length - 1) * p,
    lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}
export function resolutionMetrics(
  rows: { createdAt: Date; resolvedAt: Date; dueAt: Date }[],
) {
  const durations = rows.map((r) => {
    if (r.resolvedAt < r.createdAt)
      throw new DomainError("Invalid resolution timestamp");
    return +r.resolvedAt - +r.createdAt;
  });
  const tethered = rows.filter(
    (r) => resolutionClass(r.createdAt, r.resolvedAt) === "tethered",
  ).length;
  return {
    resolved: rows.length,
    tethered,
    untethered: rows.length - tethered,
    withinSla: rows.length
      ? (100 * rows.filter((r) => r.resolvedAt <= r.dueAt).length) / rows.length
      : null,
    average: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
    median: percentile(durations, 0.5),
    p90: percentile(durations, 0.9),
  };
}
export function selectPolicy<
  T extends {
    active: boolean;
    complaintType: string;
    issueType: string;
    primaryTag: string;
  },
>(policies: T[], complaintType: string, issueType: string, primaryTag: string) {
  const candidates = policies.filter(
    (p) =>
      p.active &&
      ((p.complaintType === complaintType &&
        p.issueType === issueType &&
        (!p.primaryTag || p.primaryTag === primaryTag)) ||
        (!p.complaintType && !p.issueType && !p.primaryTag)),
  );
  const rank = (p: T) => (p.primaryTag ? 3 : p.issueType ? 2 : 1);
  candidates.sort((a, b) => rank(b) - rank(a));
  if (!candidates.length)
    throw new DomainError(
      "Configure an SLA policy before accepting complaints",
    );
  if (candidates[1] && rank(candidates[0]) === rank(candidates[1]))
    throw new DomainError("Ambiguous SLA policies");
  return candidates[0];
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
