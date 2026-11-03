import "server-only";
import { loadTrainingCustomers } from "../../../scripts/lib/customer-service-training.cjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma } from "../../../generated/customer-service";
import { withCourseContext } from "@/lib/db";
import { scoped, Tx, CrmError } from "./db";
import { Identity, workspaceAccess, portalRoster } from "./access";
import {
  Actor,
  canRead,
  canEdit,
  supervisor,
  normalizeNumber,
  transition,
  selectPolicy,
  dateRange,
  localDate,
  resolutionMetrics,
} from "./domain";
import {
  complaintInput,
  operation,
  optionInput,
  policyInput,
} from "./validation";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const requireThat = (condition: unknown, message: string, status = 403) => {
  if (!condition) throw new CrmError(status, message);
};
const scope = (ctx: Identity, workspaceId: string) => ({
  courseId: ctx.courseId,
  workspaceId,
});
const bucket = (a: Actor): Prisma.ComplaintWhereInput =>
  supervisor(a) || a.role === "AGENT"
    ? {}
    : { queue: a.role, teamId: a.teamId || "__none__" };
async function audit(
  tx: Tx,
  ctx: Identity,
  w: string,
  action: string,
  data: unknown,
) {
  await tx.audit.create({
    data: {
      ...scope(ctx, w),
      actorId: ctx.user.id,
      actorName: ctx.user.displayName,
      action,
      data: json(data),
    },
  });
}
async function record(
  tx: Tx,
  ctx: Identity,
  w: string,
  a: Actor,
  id: string,
  action: string,
  before: unknown,
  after: unknown,
  remark: string,
  requestId: string,
) {
  await tx.history.create({
    data: {
      ...scope(ctx, w),
      complaintId: id,
      actorId: a.id,
      actorName: a.name,
      actorRole: a.role,
      action,
      before: json(before),
      after: json(after),
      remark,
      requestId,
    },
  });
}
async function validateFields(
  tx: Tx,
  w: string,
  data: z.infer<typeof complaintInput>,
  previous?: {
    callerType: string;
    channel: string;
    complaintType: string;
    issueType: string;
    primaryTag: string;
    tags: string[];
    fieldSnapshot: Prisma.JsonValue;
  },
) {
  const options = await tx.option.findMany({
    where: { workspaceId: w },
  });
  for (const kind of [
    "callerType",
    "channel",
    "complaintType",
    "issueType",
    "primaryTag",
  ] as const) {
    const id = data[kind];
    if (!id && kind === "primaryTag") continue;
    requireThat(
      options.some(
        (o) =>
          o.id === id &&
          o.kind === (kind === "primaryTag" ? "tag" : kind) &&
          (o.active || previous?.[kind] === id),
      ),
      "Choose an active " + kind,
      400,
    );
  }
  for (const id of data.tags) {
    const option = options.find((o) => o.id === id && o.kind === "tag");
    requireThat(
      option &&
        (option.active || previous?.tags.includes(id)) &&
        (!option.parentId || option.parentId === data.primaryTag),
      "Invalid secondary tag",
      400,
    );
  }
  const definitions = previous
    ? (previous.fieldSnapshot as unknown as typeof options)
    : options.filter((o) => o.kind === "field" && o.active);
  for (const key of Object.keys(data.customFields))
    requireThat(
      definitions.some((o) => o.id === key),
      "Unknown custom field",
      400,
    );
  for (const field of definitions) {
    const settings = field.settings as {
      required?: boolean;
      type?: string;
      choices?: string[];
    };
    const value = data.customFields[field.id];
    requireThat(
      !settings.required || (value !== undefined && value !== ""),
      "Complete " + field.label,
      400,
    );
    if (value !== undefined && value !== "") {
      if (settings.type === "number")
        requireThat(
          typeof value === "number" && Number.isFinite(value),
          "Invalid number: " + field.label,
          400,
        );
      if (settings.type === "date")
        requireThat(
          typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
          "Invalid date",
          400,
        );
      if (settings.type === "select")
        requireThat(
          settings.choices?.includes(String(value)),
          "Invalid selection",
          400,
        );
    }
  }
  const issue = options.find((o) => o.id === data.issueType);
  if (
    (issue?.settings as { transactionRequired?: boolean })?.transactionRequired
  )
    requireThat(
      data.transactionDate && data.transactionAmount && data.transactionId,
      "Transaction details are required",
      400,
    );
  return definitions;
}
export async function bootstrap(ctx: Identity) {
  const workspaces = await scoped(ctx.courseId, "", (tx) =>
    tx.workspace.findMany({
      where: {
        courseId: ctx.courseId,
        ...(ctx.batchId ? { batchId: ctx.batchId } : {}),
      },
      orderBy: { name: "asc" },
      take: 500,
    }),
  );
  const visible = [];
  for (const w of workspaces) {
    try {
      const role = await workspaceAccess(
        ctx,
        w.id,
        false,
        async (_tx, a) => a.role,
      );
      visible.push({ ...w, role });
    } catch (e) {
      if (!(e instanceof CrmError && e.status === 403)) throw e;
    }
  }
  const batches = ctx.admin
    ? await withCourseContext(
        { courseId: ctx.courseId, isSuperAdmin: false },
        (tx) =>
          tx.batch.findMany({
            where: { courseId: ctx.courseId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
      )
    : [];
  return {
    identity: { id: ctx.user.id, name: ctx.user.displayName },
    admin: ctx.admin,
    staff: ctx.staff,
    workspaces: visible,
    batches,
  };
}
export async function provision(ctx: Identity, body: unknown) {
  requireThat(ctx.admin, "CRM administration permission required");
  const { batchId } = z.object({ batchId: z.string().min(1) }).parse(body);
  const batch = await withCourseContext(
    { courseId: ctx.courseId, isSuperAdmin: false },
    (tx) =>
      tx.batch.findFirst({ where: { id: batchId, courseId: ctx.courseId } }),
  );
  requireThat(batch, "Batch not found", 404);
  return scoped(ctx.courseId, "", async (tx) => {
    const w = await tx.workspace.upsert({
      where: { courseId_batchId: { courseId: ctx.courseId, batchId } },
      create: { courseId: ctx.courseId, batchId, name: batch!.name },
      update: {},
    });
    await tx.$executeRaw`SELECT set_config('crm.workspace', ${w.id},true)`;
    if (w.state === "ACTIVE") {
      const training = await loadTrainingCustomers(tx, scope(ctx, w.id));
      await audit(tx, ctx, w.id, "training.load", training);
    }
    await audit(tx, ctx, w.id, "workspace.provision", { batchId });
    return w;
  });
}
export async function read(
  ctx: Identity,
  w: string,
  kind: string,
  q: URLSearchParams,
) {
  return workspaceAccess(ctx, w, false, async (tx, a) => {
    const base = { workspaceId: w, ...bucket(a) };
    if (kind === "setup") {
      const [options, policies, teams, members, staffAssignments] =
        await Promise.all([
          tx.option.findMany({
            where: { workspaceId: w },
            orderBy: { label: "asc" },
          }),
          tx.policy.findMany({ where: { workspaceId: w } }),
          tx.team.findMany({ where: { workspaceId: w } }),
          supervisor(a)
            ? tx.member.findMany({ where: { workspaceId: w } })
            : [],
          a.role === "ADMIN"
            ? tx.staffAssignment.findMany({ where: { workspaceId: w } })
            : [],
        ]);
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: w },
      });
      const roster = supervisor(a)
        ? await portalRoster(ctx, workspace.batchId)
        : [];
      return {
        options,
        policies,
        teams,
        members,
        staffAssignments,
        roster,
        actor: a,
        workspace,
      };
    }
    if (kind === "reconcile") {
      requireThat(supervisor(a), "Supervisor required");
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: w },
      });
      const roster = await portalRoster(ctx, workspace.batchId);
      const members = await tx.member.findMany({ where: { workspaceId: w } });
      return members
        .filter(
          (m) => !roster.some((p) => p.id === m.userId && p.role === "student"),
        )
        .map((m) => ({
          userId: m.userId,
          active: m.active,
          issue:
            "Portal account is missing, inactive, or no longer in this batch. Historical records retained.",
        }));
    }
    if (kind === "audit") {
      requireThat(supervisor(a), "Supervisor required");
      return tx.audit.findMany({
        where: { workspaceId: w },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }
    if (kind === "detail") {
      const c = await tx.complaint.findFirst({
        where: { ...base, id: q.get("id") || "" },
      });
      requireThat(c, "Complaint not found", 404);
      const [history, notes, interactions, followUps, escalations] =
        await Promise.all([
          tx.history.findMany({
            where: { workspaceId: w, complaintId: c!.id },
            orderBy: { createdAt: "asc" },
            take: 1000,
          }),
          tx.note.findMany({
            where: { workspaceId: w, complaintId: c!.id },
            orderBy: { createdAt: "asc" },
            take: 500,
          }),
          tx.interaction.findMany({
            where: { workspaceId: w, complaintId: c!.id },
            take: 500,
          }),
          tx.followUp.findMany({
            where: { workspaceId: w, complaintId: c!.id },
            orderBy: { dueAt: "asc" },
            take: 500,
          }),
          tx.escalation.findMany({
            where: { workspaceId: w, complaintId: c!.id },
          }),
        ]);
      const ids = [
        ...new Set(
          [
            c!.creatorId,
            c!.ownerId,
            c!.resolverId,
            ...history.map((h) => h.actorId),
          ].filter((id): id is string => !!id),
        ),
      ];
      const people = await withCourseContext(
        { courseId: ctx.courseId, isSuperAdmin: false },
        (portal) =>
          portal.user.findMany({
            where: { courseId: ctx.courseId, id: { in: ids } },
            select: { id: true, displayName: true },
          }),
      );
      return {
        complaint: c,
        history,
        notes,
        interactions,
        followUps,
        escalations,
        people,
        actor: a,
      };
    }
    if (kind === "customers") {
      const search = z
        .string()
        .max(100)
        .parse(q.get("search") || "")
        .trim();
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .parse(q.get("page") || "1");
      const where: Prisma.CustomerWhereInput = {
        workspaceId: w,
        trainingKey: { not: null },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { number: { contains: normalizeNumber(search) || search } },
                {
                  registeredNormalized: {
                    contains: normalizeNumber(search) || search,
                  },
                },
                { trainingKey: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        tx.customer.findMany({
          where,
          orderBy: { trainingKey: "asc" },
          skip: (page - 1) * 20,
          take: 20,
        }),
        tx.customer.count({ where }),
      ]);
      return { rows, total, page };
    }
    if (kind === "fetch") {
      const by = z
        .enum(["calling", "registered"])
        .parse(q.get("by") || "calling");
      const number = normalizeNumber(
        z
          .string()
          .trim()
          .min(3)
          .max(40)
          .parse(q.get("number") || ""),
      );
      requireThat(number.length >= 3, "Enter a valid contact number", 400);
      const c = await tx.complaint.findFirst({
        where: {
          ...base,
          ...(by === "registered"
            ? { registeredNormalized: number }
            : { callingNormalized: number }),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          code: true,
          createdAt: true,
          callerType: true,
          channel: true,
          issueType: true,
          complaintType: true,
          registeredNumber: true,
          callingNumber: true,
        },
      });
      const customer = await tx.customer.findFirst({
        where: {
          workspaceId: w,
          trainingKey: { not: null },
          ...(by === "registered"
            ? { registeredNormalized: number }
            : { number }),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (c) {
        const { callingNumber, ...source } = c;
        return {
          source,
          sourceKind: "complaint",
          matchedCallingNumber: callingNumber,
          customer,
          message: null,
        };
      }
      if (customer?.trainingProfile) {
        const profile = z
          .object({
            reference: z.string(),
            callerType: z.string(),
            channel: z.string(),
            issueType: z.string(),
            complaintType: z.string(),
          })
          .parse(customer.trainingProfile);
        const options = await tx.option.findMany({
          where: { workspaceId: w, active: true },
        });
        const option = (
          kind: "callerType" | "channel" | "issueType" | "complaintType",
        ) =>
          options.find((o) => o.kind === kind && o.label === profile[kind])
            ?.id || "";
        return {
          source: {
            code: profile.reference,
            createdAt: customer.createdAt,
            callerType: option("callerType"),
            channel: option("channel"),
            issueType: option("issueType"),
            complaintType: option("complaintType"),
            registeredNumber: customer.registeredNumber,
          },
          sourceKind: "training",
          matchedCallingNumber: customer.number,
          customer,
          message: null,
        };
      }
      return {
        source: null,
        customer: null,
        message:
          "No previous record or training customer found for this number",
      };
    }
    if (kind === "followups") {
      const complaints = await tx.complaint.findMany({
        where: { ...base, ...(a.role === "AGENT" ? { ownerId: a.id } : {}) },
        select: { id: true },
        take: 10000,
      });
      return tx.followUp.findMany({
        where: {
          workspaceId: w,
          complaintId: { in: complaints.map((c) => c.id) },
          ...(a.role === "AGENT" ? { responsibleId: a.id } : {}),
        },
        orderBy: { dueAt: "asc" },
        take: 500,
      });
    }
    if (kind === "report") return report(tx, a, w, q);
    const page = Math.max(1, Math.min(10000, Number(q.get("page")) || 1));
    const where: Prisma.ComplaintWhereInput = { ...base };
    if (q.get("mine") === "true") where.ownerId = a.id;
    if (q.get("callingNumber"))
      where.callingNormalized = {
        contains: normalizeNumber(q.get("callingNumber")!.slice(0, 40)),
      };
    if (q.get("registeredNumber"))
      where.registeredNormalized = {
        contains: normalizeNumber(q.get("registeredNumber")!.slice(0, 40)),
      };
    if (q.get("code"))
      where.code = { contains: q.get("code")!.slice(0, 10).toUpperCase() };
    for (const key of [
      "status",
      "issueType",
      "complaintType",
      "channel",
      "callerType",
    ] as const)
      if (q.get(key)) where[key] = q.get(key)!;
    if (q.get("queue")) where.AND = [bucket(a), { queue: q.get("queue")! }];
    const [rows, total] = await Promise.all([
      tx.complaint.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 30,
        skip: (page - 1) * 30,
      }),
      tx.complaint.count({ where }),
    ]);
    const people = await withCourseContext(
      { courseId: ctx.courseId, isSuperAdmin: false },
      (portal) =>
        portal.user.findMany({
          where: {
            courseId: ctx.courseId,
            id: {
              in: [
                ...new Set(
                  rows
                    .flatMap((c) => [c.creatorId, c.ownerId, c.resolverId])
                    .filter((v): v is string => !!v),
                ),
              ],
            },
          },
          select: { id: true, displayName: true },
        }),
    );
    return { rows, total, page, people };
  });
}
async function report(tx: Tx, a: Actor, w: string, q: URLSearchParams) {
  const today = localDate(new Date());
  const { start, end } = dateRange(
    q.get("from") || today.slice(0, 8) + "01",
    q.get("to") || today,
  );
  const cutoff = new Date(Math.min(+end, Date.now()));
  const filters: Prisma.ComplaintWhereInput = { workspaceId: w, ...bucket(a) };
  for (const key of [
    "status",
    "channel",
    "issueType",
    "complaintType",
    "callerType",
  ] as const)
    if (q.get(key)) filters[key] = q.get(key)!;
  if (q.get("tag"))
    filters.OR = [
      { primaryTag: q.get("tag")! },
      { tags: { has: q.get("tag")! } },
    ];
  const rows = await tx.complaint.findMany({
    where: { ...filters, createdAt: { lt: end } },
    take: 10001,
  });
  requireThat(
    rows.length <= 10000,
    "Report exceeds 10,000 complaints. Narrow the filters.",
    422,
  );
  const agent = a.role === "AGENT" ? a.id : q.get("agent");
  const created = rows.filter(
    (c) => c.createdAt >= start && (!agent || c.creatorId === agent),
  );
  const resolved = rows.filter(
    (c) =>
      c.status === "RESOLVED" &&
      c.resolvedAt &&
      c.resolvedAt >= start &&
      c.resolvedAt < end &&
      (!agent || c.resolverId === agent),
  );
  const pending = rows.filter(
    (c) =>
      c.createdAt < cutoff &&
      (!c.closedAt || c.closedAt >= cutoff) &&
      (!agent || c.creatorId === agent),
  );
  const ids = rows.map((c) => c.id);
  const [contacts, events] = await Promise.all([
    tx.interaction.findMany({
      where: {
        workspaceId: w,
        complaintId: { in: ids },
        createdAt: { gte: start, lt: end },
        ...(agent ? { actorId: agent } : {}),
      },
      select: { id: true, actorId: true, complaintId: true },
      take: 100001,
    }),
    tx.history.findMany({
      where: {
        workspaceId: w,
        complaintId: { in: ids },
        createdAt: { gte: start, lt: end },
        action: { in: ["escalate", "resubmit"] },
        ...(agent ? { actorId: agent } : {}),
      },
      select: { complaintId: true, actorId: true },
      take: 100001,
    }),
  ]);
  requireThat(
    contacts.length <= 100000 && events.length <= 100000,
    "Too many events. Narrow the report period.",
    422,
  );
  const group = (
    key: "issueType" | "complaintType" | "callerType" | "channel" | "creatorId",
  ) =>
    Object.entries(
      created.reduce(
        (acc, c) => {
          acc[c[key]] = (acc[c[key]] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    ).map(([name, count]) => ({ name, count }));
  const agentIds = [
    ...new Set([
      ...created.map((c) => c.creatorId),
      ...resolved.map((c) => c.resolverId!).filter(Boolean),
      ...contacts.map((c) => c.actorId),
      ...events.map((e) => e.actorId),
    ]),
  ];
  const agents = agentIds.map((id) => ({
    id,
    complaints: created.filter((c) => c.creatorId === id).length,
    interactions: contacts.filter((c) => c.actorId === id).length,
    escalations: new Set(
      events.filter((e) => e.actorId === id).map((e) => e.complaintId),
    ).size,
    ...resolutionMetrics(
      resolved
        .filter((c) => c.resolverId === id)
        .map((c) => ({
          createdAt: c.createdAt,
          resolvedAt: c.resolvedAt!,
          dueAt: c.dueAt,
        })),
    ),
  }));
  const tags = Object.entries(
    created.reduce(
      (acc, c) => {
        for (const tag of new Set([c.primaryTag, ...c.tags].filter(Boolean)))
          acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ).map(([name, count]) => ({ name, count }));
  return {
    agents,
    range: {
      from: q.get("from") || today.slice(0, 8) + "01",
      to: q.get("to") || today,
      timezone: "Asia/Dhaka",
    },
    filters: Object.fromEntries(q),
    basis:
      "Volumes: creation/contact/escalation date. Resolution KPIs: final resolution date and actual resolver. Pending: period-end snapshot, original creator. Other filters use current complaint attributes.",
    metrics: {
      ...resolutionMetrics(
        resolved.map((c) => ({
          createdAt: c.createdAt,
          resolvedAt: c.resolvedAt!,
          dueAt: c.dueAt,
        })),
      ),
      complaints: created.length,
      interactions: contacts.length,
      escalations: new Set(events.map((e) => e.complaintId)).size,
      pending: pending.length,
    },
    breakdowns: {
      tag: tags,
      issueType: group("issueType"),
      complaintType: group("complaintType"),
      callerType: group("callerType"),
      channel: group("channel"),
      agent: group("creatorId"),
    },
    rows: resolved,
    created,
  };
}
export async function mutate(ctx: Identity, raw: unknown) {
  const b = operation.parse(raw),
    w = b.workspaceId;
  return workspaceAccess(ctx, w, b.action !== "workspace", async (tx, a) => {
    const s = scope(ctx, w);
    if (b.action === "team") {
      requireThat(a.role === "ADMIN", "CRM administrator required");
      const data = z
        .object({
          name: z.string().trim().min(1).max(100),
          tier: z.enum(["L2", "L3"]),
          active: z.boolean().default(true),
        })
        .strict()
        .parse(b.data);
      const result = b.id
        ? await tx.team.update({
            where: { workspaceId_id: { workspaceId: w, id: b.id } },
            data,
          })
        : await tx.team.create({ data: { ...s, ...data } });
      await audit(tx, ctx, w, b.action, result);
      return result;
    }
    if (b.action === "member" || b.action === "staff") {
      requireThat(a.role === "ADMIN", "CRM administrator required");
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: w },
      });
      const roster = await portalRoster(ctx, workspace.batchId);
      const target = roster.find((u) => u.id === b.userId);
      if (
        b.action === "member" &&
        !target &&
        (b.data as { active?: boolean })?.active === false
      ) {
        const result = await tx.member.updateMany({
          where: { workspaceId: w, userId: b.userId },
          data: { active: false },
        });
        await audit(tx, ctx, w, "member.deactivate", { userId: b.userId });
        return result;
      }
      requireThat(target, "Eligible portal user required", 400);
      if (b.action === "staff") {
        requireThat(target!.role !== "student", "Staff account required", 400);
        const { active } = z.object({ active: z.boolean() }).parse(b.data);
        if (active)
          await tx.staffAssignment.upsert({
            where: {
              workspaceId_userId: { workspaceId: w, userId: target!.id },
            },
            create: { ...s, userId: target!.id },
            update: {},
          });
        else
          await tx.staffAssignment.deleteMany({
            where: { workspaceId: w, userId: target!.id },
          });
        await audit(tx, ctx, w, b.action, { userId: b.userId, active });
        return { ok: true };
      }
      requireThat(
        target!.role === "student",
        "Select a student in this batch",
        400,
      );
      const data = z
        .object({
          role: z.enum(["AGENT", "L2", "L3"]),
          teamId: z.string().nullable().default(null),
          active: z.boolean().default(true),
        })
        .strict()
        .parse(b.data);
      if (data.role !== "AGENT")
        requireThat(
          data.teamId &&
            (await tx.team.findFirst({
              where: {
                id: data.teamId,
                workspaceId: w,
                active: true,
                tier: data.role,
              },
            })),
          "Select a matching active team",
          400,
        );
      else data.teamId = null;
      const result = await tx.member.upsert({
        where: { workspaceId_userId: { workspaceId: w, userId: target!.id } },
        create: { ...s, userId: target!.id, ...data },
        update: data,
      });
      await audit(tx, ctx, w, b.action, result);
      return result;
    }
    if (b.action === "workspace") {
      requireThat(a.role === "ADMIN", "CRM administrator required");
      const data = z
        .object({ state: z.enum(["ACTIVE", "READ_ONLY", "ARCHIVED"]) })
        .parse(b.data);
      const result = await tx.workspace.update({ where: { id: w }, data });
      await audit(tx, ctx, w, b.action, data);
      return result;
    }
    if (b.action === "option") {
      requireThat(supervisor(a), "Supervisor required");
      const data = optionInput.parse(b.data);
      if (data.parentId)
        requireThat(
          data.kind === "tag" &&
            (await tx.option.findFirst({
              where: {
                workspaceId: w,
                id: data.parentId,
                kind: "tag",
                active: true,
                parentId: null,
              },
            })),
          "Choose a primary tag",
          400,
        );
      const result = b.id
        ? await tx.option.update({
            where: { workspaceId_id: { workspaceId: w, id: b.id } },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.option.create({ data: { ...s, ...data } });
      await audit(tx, ctx, w, b.action, result);
      return result;
    }
    if (b.action === "policy") {
      requireThat(supervisor(a), "Supervisor required");
      const data = policyInput.parse(b.data);
      requireThat(
        (!data.issueType && !data.complaintType && !data.primaryTag) ||
          (data.issueType && data.complaintType),
        "Select both complaint and issue type, or neither for fallback",
        400,
      );
      for (const [kind, id] of [
        ["issueType", data.issueType],
        ["complaintType", data.complaintType],
        ["tag", data.primaryTag],
      ])
        if (id)
          requireThat(
            await tx.option.findFirst({
              where: { workspaceId: w, id, kind, active: true },
            }),
            "Invalid policy option",
            400,
          );
      const key = JSON.stringify([
        data.complaintType,
        data.issueType,
        data.primaryTag,
      ]);
      const result = await tx.policy.upsert({
        where: { workspaceId_key: { workspaceId: w, key } },
        create: { ...s, key, ...data },
        update: { ...data, version: { increment: 1 } },
      });
      await audit(tx, ctx, w, b.action, result);
      return result;
    }
    if (b.action === "dummy") {
      requireThat(a.role === "ADMIN", "CRM administrator required");
      const result = await loadTrainingCustomers(tx, s);
      await audit(tx, ctx, w, "training.load", result);
      return { ok: true, ...result };
    }
    if (b.action === "create") {
      requireThat(
        a.role === "AGENT" || supervisor(a),
        "Only agents and supervisors create complaints",
      );
      const existing = await tx.complaint.findUnique({
        where: {
          workspaceId_creatorId_requestId: {
            workspaceId: w,
            creatorId: a.id,
            requestId: b.requestId,
          },
        },
      });
      if (existing) return existing;
      const data = complaintInput.parse(b.data);
      const definitions = await validateFields(tx, w, data);
      const policy = selectPolicy(
        await tx.policy.findMany({ where: { workspaceId: w } }),
        data.complaintType,
        data.issueType,
        data.primaryTag,
      );
      const now = new Date();
      const customer = await tx.customer.upsert({
        where: {
          workspaceId_number: {
            workspaceId: w,
            number: normalizeNumber(data.callingNumber),
          },
        },
        create: {
          ...s,
          name: data.identifier || "Training customer",
          number: normalizeNumber(data.callingNumber),
          dummy: true,
        },
        update: {},
      });
      const code = Array.from(
        randomBytes(10),
        (byte) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[byte % 36],
      ).join("");
      const c = await tx.complaint.create({
        data: {
          ...s,
          ...data,
          code,
          requestId: b.requestId,
          customerId: customer.id,
          creatorId: a.id,
          ownerId: a.id,
          callingNormalized: normalizeNumber(data.callingNumber),
          registeredNormalized: normalizeNumber(data.registeredNumber),
          transactionDate: data.transactionDate
            ? new Date(data.transactionDate)
            : null,
          policySnapshot: json(policy),
          fieldSnapshot: json(definitions),
          dueAt: new Date(+now + policy.overallMinutes * 60000),
          createdAt: now,
        },
      });
      await tx.interaction.create({
        data: {
          ...s,
          complaintId: c.id,
          actorId: a.id,
          channel: c.channel,
          note: "Initial customer contact",
        },
      });
      await record(tx, ctx, w, a, c.id, "create", {}, c, "", b.requestId);
      if (b.initialAction && b.initialAction !== "pending") {
        if (b.initialAction === "resolve")
          requireThat(
            b.resolutionReason &&
              (await tx.option.findFirst({
                where: {
                  workspaceId: w,
                  id: b.resolutionReason,
                  kind: "resolutionReason",
                  active: true,
                },
              })),
            "Select a resolution reason",
            400,
          );
        if (b.initialAction === "escalate")
          requireThat(
            b.teamId &&
              (await tx.team.findFirst({
                where: {
                  workspaceId: w,
                  id: b.teamId,
                  tier: "L2",
                  active: true,
                },
              })),
            "Select an active L2 team",
            400,
          );
        const next = transition(
          c,
          a,
          b.initialAction,
          b.remark,
          new Date(),
          policy,
          b.teamId,
        );
        const submitted = await tx.complaint.update({
          where: { id: c.id },
          data: {
            ...next,
            resolutionReason: b.resolutionReason || "",
            version: { increment: 1 },
          },
        });
        if (submitted.firstL2At)
          await tx.escalation.create({
            data: {
              ...s,
              complaintId: c.id,
              stage: "L2",
              startedAt: submitted.firstL2At,
              targetMinutes: policy.l2Minutes,
            },
          });
        await record(
          tx,
          ctx,
          w,
          a,
          c.id,
          b.initialAction,
          c,
          submitted,
          b.remark,
          b.requestId + ":submit",
        );
        return submitted;
      }
      return c;
    }
    const c = await tx.complaint.findFirst({
      where: { workspaceId: w, id: b.id, ...bucket(a) },
    });
    requireThat(c && canRead(a, c), "Complaint not found", 404);
    const prior = await tx.history.findUnique({
      where: {
        workspaceId_complaintId_requestId: {
          workspaceId: w,
          complaintId: c!.id,
          requestId: b.requestId,
        },
      },
    });
    if (prior) return c;
    requireThat(
      b.version === c!.version,
      "This complaint changed. Refresh and try again.",
      409,
    );
    let data: Prisma.ComplaintUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    let result: unknown;
    if (b.action === "edit") {
      requireThat(canEdit(a, c!), "You cannot edit this complaint");
      const fields = complaintInput.parse(b.data);
      const definitions = await validateFields(tx, w, fields, c!);
      data = {
        ...data,
        ...fields,
        transactionDate: fields.transactionDate
          ? new Date(fields.transactionDate)
          : null,
        callingNormalized: normalizeNumber(fields.callingNumber),
        registeredNormalized: normalizeNumber(fields.registeredNumber),
        fieldSnapshot: json(definitions),
      };
      if (
        fields.issueType !== c!.issueType ||
        fields.complaintType !== c!.complaintType ||
        fields.primaryTag !== c!.primaryTag
      ) {
        requireThat(
          !c!.firstL2At || supervisor(a),
          "Only supervisors can correct escalated policy fields",
        );
        const policy = selectPolicy(
          await tx.policy.findMany({ where: { workspaceId: w } }),
          fields.complaintType,
          fields.issueType,
          fields.primaryTag,
        );
        data.policySnapshot = json(policy);
        data.dueAt = new Date(+c!.createdAt + policy.overallMinutes * 60000);
        data.l2DueAt =
          c!.firstL2At && policy.l2Minutes
            ? new Date(+c!.firstL2At + policy.l2Minutes * 60000)
            : null;
        data.l3DueAt =
          c!.firstL3At && policy.l3Minutes
            ? new Date(+c!.firstL3At + policy.l3Minutes * 60000)
            : null;
      }
    } else if (b.action === "assign") {
      requireThat(supervisor(a), "Supervisor required");
      requireThat(
        c!.status !== "RESOLVED" && c!.status !== "INVALID",
        "Closed work cannot be reassigned",
        409,
      );
      const member = await tx.member.findFirst({
        where: {
          workspaceId: w,
          userId: b.userId,
          active: true,
          role: c!.queue,
          ...(c!.queue === "AGENT" ? {} : { teamId: c!.teamId }),
        },
      });
      requireThat(member, "Select an active member of the current queue", 400);
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: w },
      });
      requireThat(
        (await portalRoster(ctx, workspace.batchId)).some(
          (u) => u.id === b.userId,
        ),
        "Member is no longer eligible",
        400,
      );
      data.ownerId = b.userId;
    } else if (
      ["note", "interaction", "followup", "complete_followup"].includes(
        b.action,
      )
    ) {
      requireThat(
        canEdit(a, c!) ||
          (c!.status !== "RESOLVED" &&
            c!.status !== "INVALID" &&
            c!.ownerId === a.id &&
            c!.queue === a.role),
        "You cannot modify this complaint",
      );
      requireThat(b.remark.trim(), "A note is required", 400);
      if (b.action === "note")
        result = await tx.note.create({
          data: { ...s, complaintId: c!.id, actorId: a.id, text: b.remark },
        });
      if (b.action === "interaction")
        result = await tx.interaction.create({
          data: {
            ...s,
            complaintId: c!.id,
            actorId: a.id,
            channel: c!.channel,
            note: b.remark,
          },
        });
      if (b.action === "followup") {
        const f = z.object({ dueAt: z.string().datetime() }).parse(b.data);
        result = await tx.followUp.create({
          data: {
            ...s,
            complaintId: c!.id,
            responsibleId: c!.ownerId || a.id,
            dueAt: new Date(f.dueAt),
            note: b.remark,
          },
        });
      }
      if (b.action === "complete_followup") {
        const f = z.object({ followUpId: z.string() }).parse(b.data);
        const changed = await tx.followUp.updateMany({
          where: {
            workspaceId: w,
            id: f.followUpId,
            complaintId: c!.id,
            completedAt: null,
            ...(supervisor(a) ? {} : { responsibleId: a.id }),
          },
          data: { completedAt: new Date() },
        });
        requireThat(changed.count === 1, "Follow-up unavailable", 409);
      }
    } else {
      const policy = c!.policySnapshot as {
        l2Minutes?: number | null;
        l3Minutes?: number | null;
      };
      if (b.action === "escalate" || b.action === "resubmit")
        requireThat(
          b.teamId &&
            (await tx.team.findFirst({
              where: {
                workspaceId: w,
                id: b.teamId,
                active: true,
                tier: c!.queue === "AGENT" ? "L2" : "L3",
              },
            })),
          "Select an active destination team",
          400,
        );
      const next = transition(
        c!,
        a,
        b.action,
        b.remark,
        new Date(),
        policy,
        b.teamId,
      );
      data = { ...data, ...next };
      if (b.action === "resolve") {
        const value = z
          .object({ resolutionReason: z.string().min(1) })
          .parse(b.data);
        requireThat(
          await tx.option.findFirst({
            where: {
              workspaceId: w,
              id: value.resolutionReason,
              kind: "resolutionReason",
              active: true,
            },
          }),
          "Select a resolution reason",
          400,
        );
        data.resolutionReason = value.resolutionReason;
      }
      if (next.firstL2At)
        await tx.escalation.upsert({
          where: {
            workspaceId_complaintId_stage: {
              workspaceId: w,
              complaintId: c!.id,
              stage: "L2",
            },
          },
          create: {
            ...s,
            complaintId: c!.id,
            stage: "L2",
            startedAt: next.firstL2At,
            completedAt: next.l2CompletedAt,
            targetMinutes: policy.l2Minutes,
          },
          update: { completedAt: next.l2CompletedAt },
        });
      if (next.firstL3At)
        await tx.escalation.upsert({
          where: {
            workspaceId_complaintId_stage: {
              workspaceId: w,
              complaintId: c!.id,
              stage: "L3",
            },
          },
          create: {
            ...s,
            complaintId: c!.id,
            stage: "L3",
            startedAt: next.firstL3At,
            completedAt: next.closedAt,
            targetMinutes: policy.l3Minutes,
          },
          update: { completedAt: next.closedAt },
        });
    }
    const changed = await tx.complaint.updateMany({
      where: { workspaceId: w, id: c!.id, version: b.version },
      data,
    });
    requireThat(
      changed.count === 1,
      "This complaint changed. Refresh and try again.",
      409,
    );
    const after = await tx.complaint.findUniqueOrThrow({
      where: { id: c!.id },
    });
    await record(
      tx,
      ctx,
      w,
      a,
      c!.id,
      b.action,
      c,
      { complaint: after, result: result ?? null },
      b.remark,
      b.requestId,
    );
    return after;
  });
}
