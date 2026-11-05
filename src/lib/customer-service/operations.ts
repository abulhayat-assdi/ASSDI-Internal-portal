import "server-only";
import { z } from "zod";
import { Tx, CrmError } from "./db";
import { Identity, portalRoster } from "./access";
import {
  Actor,
  supervisor,
  dateRange,
  localDate,
  resolutionMetrics,
} from "./domain";
import { Prisma } from "../../../generated/customer-service";

const fail = (condition: unknown, message: string, status = 403) => {
  if (!condition) throw new CrmError(status, message);
};
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function roster(tx: Tx, ctx: Identity, w: string) {
  const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: w } });
  const people = await portalRoster(ctx, workspace.batchId);
  const members = await tx.member.findMany({ where: { workspaceId: w } });
  return { people, members };
}
export async function notificationInbox(tx: Tx, w: string, actor: Actor) {
  const where = { workspaceId: w, userId: actor.id };
  const [items, unread] = await Promise.all([
    tx.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
    tx.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { items, unread };
}
export async function markNotificationsRead(
  tx: Tx,
  w: string,
  actor: Actor,
  raw: unknown,
) {
  const data = z
    .object({
      ids: z.array(z.string().min(1)).max(50).optional(),
      all: z.boolean().optional(),
    })
    .strict()
    .parse(raw);
  fail(data.all || data.ids?.length, "Choose notifications to mark read", 400);
  return tx.notification.updateMany({
    where: {
      workspaceId: w,
      userId: actor.id,
      readAt: null,
      ...(data.all ? {} : { id: { in: data.ids } }),
    },
    data: { readAt: new Date() },
  });
}
export async function assignmentPool(
  tx: Tx,
  ctx: Identity,
  w: string,
  actor: Actor,
) {
  fail(supervisor(actor), "Supervisor required");
  const { people, members } = await roster(tx, ctx, w);
  const agents = people
    .filter((p) => {
      const member = members.find((m) => m.userId === p.id);
      return (
        p.role === "student" &&
        (!member || (member.active && member.role === "AGENT"))
      );
    })
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id),
    );
  const staffIds = people.filter((p) => p.role !== "student").map((p) => p.id);
  const where = {
    workspaceId: w,
    status: "PENDING",
    queue: "AGENT",
    returnState: "NORMAL",
    closedAt: null,
    OR: [{ ownerId: null }, { ownerId: { in: staffIds } }],
  };
  const [cases, total] = await Promise.all([
    tx.complaint.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 250,
      select: { id: true, code: true, version: true, description: true },
    }),
    tx.complaint.count({ where }),
  ]);
  return {
    agents: agents.map((p) => ({
      id: p.id,
      name: p.displayName,
      roll: p.studentRoll,
    })),
    cases,
    total,
  };
}
export async function bulkAssign(
  tx: Tx,
  ctx: Identity,
  w: string,
  actor: Actor,
  raw: unknown,
  requestId: string,
) {
  fail(supervisor(actor), "Supervisor required");
  const data = z
    .object({
      allocations: z
        .array(
          z
            .object({
              id: z.string().min(1),
              version: z.number().int().positive(),
              userId: z.string().min(1),
            })
            .strict(),
        )
        .min(1)
        .max(250),
      reason: z.string().trim().min(1).max(1000),
    })
    .strict()
    .parse(raw);
  fail(
    new Set(data.allocations.map((x) => x.id)).size === data.allocations.length,
    "Duplicate complaints are not allowed",
    400,
  );
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${w}), 401)`;
  const replay = await tx.audit.findFirst({
    where: {
      workspaceId: w,
      actorId: actor.id,
      action: "bulk_assign",
      data: { path: ["requestId"], equals: requestId },
    },
  });
  if (replay) return (replay.data as { result: { assigned: number } }).result;
  const pool = await assignmentPool(tx, ctx, w, actor);
  const eligible = new Set(pool.agents.map((p) => p.id));
  fail(
    data.allocations.every((x) => eligible.has(x.userId)),
    "Choose active eligible Agents in this batch",
    400,
  );
  fail(
    data.allocations.every((x) =>
      pool.cases.some((c) => c.id === x.id && c.version === x.version),
    ),
    "The assignment pool changed. Reload the preview before assigning.",
    409,
  );
  const s = { courseId: ctx.courseId, workspaceId: w };
  await tx.member.createMany({
    data: [...new Set(data.allocations.map((x) => x.userId))].map((userId) => ({
      ...s,
      userId,
      role: "AGENT",
      active: true,
    })),
    skipDuplicates: true,
  });
  const targets = [...new Set(data.allocations.map((x) => x.userId))];
  const locked = await tx.$queryRaw<
    { userId: string; active: boolean; role: string }[]
  >(
    Prisma.sql`SELECT "userId",active,role FROM "Member" WHERE "workspaceId"=${w} AND "userId" IN (${Prisma.join(targets)}) FOR UPDATE`,
  );
  fail(
    locked.length === targets.length &&
      locked.every((m) => m.active && m.role === "AGENT"),
    "Agent membership changed. Reload the preview.",
    409,
  );
  const cases = await tx.complaint.findMany({
    where: { workspaceId: w, id: { in: data.allocations.map((x) => x.id) } },
  });
  const histories: Prisma.HistoryCreateManyInput[] = [],
    notices: Prisma.NotificationCreateManyInput[] = [];
  let followupsTransferred = 0;
  for (const allocation of data.allocations) {
    const before = cases.find((c) => c.id === allocation.id)!;
    const changed = await tx.complaint.updateMany({
      where: {
        workspaceId: w,
        id: before.id,
        version: allocation.version,
        status: "PENDING",
        queue: "AGENT",
      },
      data: { ownerId: allocation.userId, version: { increment: 1 } },
    });
    fail(
      changed.count === 1,
      "A complaint changed. Reload the preview before assigning.",
      409,
    );
    followupsTransferred += await handoffFollowUps(
      tx,
      w,
      before.id,
      before.ownerId,
      allocation.userId,
    );
    histories.push({
      ...s,
      complaintId: before.id,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "assign",
      before: json(before),
      after: json({
        complaint: {
          ...before,
          ownerId: allocation.userId,
          version: before.version + 1,
        },
      }),
      remark: data.reason,
      requestId,
    });
    notices.push({
      ...s,
      complaintId: before.id,
      userId: allocation.userId,
      eventKey: `${requestId}:${before.id}`,
      message: `${before.code}: a new complaint has been assigned to you.`,
    });
  }
  await tx.history.createMany({ data: histories });
  await tx.notification.createMany({ data: notices, skipDuplicates: true });
  const result = { assigned: data.allocations.length };
  await tx.audit.create({
    data: {
      ...s,
      actorId: actor.id,
      actorName: actor.name,
      action: "bulk_assign",
      data: json({
        requestId,
        reason: data.reason,
        allocations: data.allocations,
        followupsTransferred,
        result,
      }),
    },
  });
  return result;
}
export async function handoffFollowUps(
  tx: Tx,
  w: string,
  complaintId: string,
  oldOwner: string | null,
  newOwner: string,
) {
  if (!oldOwner || oldOwner === newOwner) return 0;
  const result = await tx.followUp.updateMany({
    where: {
      workspaceId: w,
      complaintId,
      responsibleId: oldOwner,
      completedAt: null,
    },
    data: { responsibleId: newOwner },
  });
  return result.count;
}
type Change = {
  id: string;
  code: string;
  ownerId: string | null;
  creatorId: string;
  queue: string;
  teamId: string | null;
  status: string;
};
export async function notifyWorkflow(
  tx: Tx,
  ctx: Identity,
  w: string,
  actor: Actor,
  before: Change,
  after: Change,
  requestId: string,
) {
  const recipients = new Map<string, string>();
  if (after.ownerId && after.ownerId !== before.ownerId)
    recipients.set(
      after.ownerId,
      `${after.code}: a complaint has been assigned or returned to you.`,
    );
  if (after.queue !== before.queue && !after.ownerId && after.teamId) {
    const members =
      after.queue === "AGENT"
        ? []
        : await tx.member.findMany({
            where: {
              workspaceId: w,
              active: true,
              teamId: after.teamId,
              role: after.queue,
            },
          });
    for (const m of members)
      recipients.set(
        m.userId,
        `${after.code}: an escalation is waiting in your team queue.`,
      );
    const { people } = await roster(tx, ctx, w);
    const staff = await tx.staffAssignment.findMany({
      where: { workspaceId: w },
    });
    for (const p of people.filter(
      (p) => p.role === "admin" || staff.some((s) => s.userId === p.id),
    ))
      recipients.set(
        p.id,
        after.queue === "AGENT"
          ? `${after.code}: a returned complaint needs an active Agent.`
          : `${after.code}: a new escalation needs attention.`,
      );
  }
  if (after.status === "RESOLVED" && before.status !== "RESOLVED")
    recipients.set(
      after.creatorId,
      `${after.code}: the complaint has been resolved.`,
    );
  recipients.delete(actor.id);
  if (recipients.size)
    await tx.notification.createMany({
      data: [...recipients].map(([userId, message]) => ({
        courseId: ctx.courseId,
        workspaceId: w,
        complaintId: after.id,
        userId,
        message,
        eventKey: `${requestId}:${after.id}`,
      })),
      skipDuplicates: true,
    });
}
export async function studentProgress(
  tx: Tx,
  ctx: Identity,
  w: string,
  actor: Actor,
  q: URLSearchParams,
) {
  const today = localDate(new Date());
  const from = q.get("from") || today.slice(0, 8) + "01",
    to = q.get("to") || today;
  const { start, end } = dateRange(from, to);
  const { people, members } = await roster(tx, ctx, w);
  const students = people.filter(
    (p) => p.role === "student" && (supervisor(actor) || p.id === actor.id),
  );
  const ids = students.map((p) => p.id);
  const [cases, events, contacts] = await Promise.all([
    tx.complaint.findMany({
      where: {
        workspaceId: w,
        OR: [
          { ownerId: { in: ids } },
          { creatorId: { in: ids } },
          { resolverId: { in: ids }, resolvedAt: { gte: start, lt: end } },
        ],
      },
      take: 10001,
      select: {
        id: true,
        ownerId: true,
        creatorId: true,
        resolverId: true,
        status: true,
        closedAt: true,
        createdAt: true,
        resolvedAt: true,
        dueAt: true,
      },
    }),
    tx.history.findMany({
      where: { workspaceId: w, createdAt: { gte: start, lt: end } },
      take: 100001,
      select: {
        actorId: true,
        complaintId: true,
        action: true,
        createdAt: true,
        after: true,
      },
    }),
    tx.interaction.findMany({
      where: {
        workspaceId: w,
        actorId: { in: ids },
        createdAt: { gte: start, lt: end },
      },
      take: 100001,
      select: { actorId: true, complaintId: true },
    }),
  ]);
  fail(
    cases.length <= 10000 &&
      events.length <= 100000 &&
      contacts.length <= 100000,
    "Progress data is too large. Narrow the date range.",
    422,
  );
  const now = new Date();
  const rows = students.map((p) => {
    const member = members.find((m) => m.userId === p.id);
    const open = cases.filter((c) => c.ownerId === p.id && !c.closedAt);
    const resolved = cases.filter(
      (c) =>
        c.resolverId === p.id &&
        c.status === "RESOLVED" &&
        c.resolvedAt &&
        c.resolvedAt >= start &&
        c.resolvedAt < end,
    );
    const acted = events.filter((h) => h.actorId === p.id);
    const assignments = events.filter(
      (h) =>
        h.action === "assign" &&
        (h.after as { complaint?: { ownerId?: string } }).complaint?.ownerId ===
          p.id,
    );
    const metrics = resolutionMetrics(
      resolved.map((c) => ({
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt!,
        dueAt: c.dueAt,
      })),
    );
    return {
      id: p.id,
      name: p.displayName,
      roll: p.studentRoll,
      role: member?.role || "AGENT",
      active: member?.active ?? true,
      assignedNow: open.length,
      pending: open.filter((c) => c.status === "PENDING").length,
      inProgress: open.filter((c) => c.status === "IN_PROGRESS").length,
      overdue: open.filter((c) => c.dueAt < now).length,
      assignedInPeriod: new Set(assignments.map((h) => h.complaintId)).size,
      created: cases.filter(
        (c) =>
          c.creatorId === p.id && c.createdAt >= start && c.createdAt < end,
      ).length,
      worked: new Set(
        acted
          .filter((h) =>
            [
              "progress",
              "create",
              "edit",
              "resolve",
              "escalate",
              "resubmit",
              "interaction",
              "note",
              "followup",
              "complete_followup",
            ].includes(h.action),
          )
          .map((h) => h.complaintId),
      ).size,
      contacts: contacts.filter((c) => c.actorId === p.id).length,
      escalated: new Set(
        acted
          .filter((h) => ["escalate", "resubmit"].includes(h.action))
          .map((h) => h.complaintId),
      ).size,
      resolved: metrics.resolved,
      withinSla: metrics.withinSla,
      averageTat: metrics.average,
      lastActivity: acted.reduce<string | null>(
        (latest, h) =>
          !latest || h.createdAt.toISOString() > latest
            ? h.createdAt.toISOString()
            : latest,
        null,
      ),
    };
  });
  return {
    rows,
    from,
    to,
    asOf: now.toISOString(),
    basis:
      "Open workload is current. Assignments, work and resolutions use the selected dates in Asia/Dhaka. TAT is creation-to-resolution, not active working time. Assigned cases are separate from cases created by the student.",
  };
}
