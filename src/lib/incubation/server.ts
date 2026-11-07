import "server-only";
import { createHash, randomBytes } from "node:crypto";
import {
  Prisma,
  type IncubationProgram,
  type IncubationRecord,
} from "@prisma/client";
import { z } from "zod";
import type { JWTPayload } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { isFeatureEnabled } from "@/lib/features";
import {
  checkTransition,
  incubationState,
  isIncubationRunning,
  isProgramLocked,
  lockedMessage,
  PROGRAM_STATUSES,
} from "./lifecycle";
import { withCourseContext } from "@/lib/db";
import { buildMonitor, issuesFor } from "./monitor";
import { buildReport } from "./report";
import { RESULT_METRIC, rankTeams } from "./results";
import {
  calculateLedger,
  FINANCIAL_KINDS,
  insist,
  IncubationError,
  isLate,
  scaled,
  todayDhaka,
  validDate,
  type Entry,
  type EntryData,
  type RecordKind,
} from "./domain";

type Tx = Prisma.TransactionClient;
export type Actor = JWTPayload & { courseId: string };
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const text = z.string().trim().min(1).max(500);
const id = z.string().min(1).max(100);
const day = z.string().refine(validDate, "সঠিক তারিখ দিন।");
const numberText = z.union([z.string(), z.number()]).transform(String);
const entryDataSchema = z
  .object({
    lines: z
      .array(
        z.object({
          productId: id,
          quantity: numberText,
          unitPrice: numberText.optional(),
          cash: numberText.optional(),
        }),
      )
      .max(100)
      .optional(),
    amount: numberText.optional(),
    reason: z.string().max(2000).optional(),
    note: z.string().max(5000).optional(),
    voucherId: id.optional(),
    areaId: id.optional(),
    categoryId: id.optional(),
    expenseType: z.string().max(100).optional(),
    sourceId: id.optional(),
    saleable: z.boolean().optional(),
    session: z.string().max(100).optional(),
    round: z.string().max(100).optional(),
    findings: z.array(z.string().trim().max(500)).min(1).max(3).optional(),
    actions: z.array(z.string().trim().max(500)).min(1).max(3).optional(),
    segment: z.string().max(500).optional(),
    objections: z.string().max(2000).optional(),
    whyBought: z.string().max(2000).optional(),
    bestArea: z.string().max(500).optional(),
  })
  .strict();
export const settingsSchema = z
  .object({
    sprintDays: z.number().int().min(1).max(365),
    enforceCategory: z.boolean(),
    maxFieldHours: z.number().min(0.25).max(168).nullable(),
    trackingMinutes: z.number().int().min(1).max(60),
    retentionDays: z.number().int().min(1).max(730),
    expenseTypes: z.array(text).min(1).max(30),
    sessions: z.array(text).max(30).default([]),
    sessionsRequired: z.boolean().default(false),
    segments: z.array(text).max(50).default([]),
    objections: z.array(text).max(50).default([]),
    fgdRequiredCount: z.number().int().min(1).max(3).default(1),
    whyBoughtRequired: z.boolean().default(false),
    salesReminder: z.boolean().default(true),
    fgdEveryDays: z.number().int().min(1).max(30).nullable().default(null),
  })
  .strict();
export const isManager = (a: JWTPayload) =>
  ["teacher", "admin", "super_admin"].includes(a.role) &&
  (a.role === "teacher" ||
    hasPermission(a.role, a.permissions, "admin_incubation") ||
    hasPermission(a.role, a.permissions, "business_incubation") ||
    hasPermission(a.role, a.permissions, "admin_competitions"));
export const isSupervisor = (a: JWTPayload) =>
  isManager(a) || hasPermission(a.role, a.permissions, "business_incubation");
export async function featureTx<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
  return withCourseContext(
    { courseId: actor.courseId, isSuperAdmin: false },
    async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: actor.courseId },
        select: { settings: true },
      });
      insist(
        course && isFeatureEnabled(course.settings, "business_incubation"),
        "এই কোর্সে Business Incubation চালু নেই।",
        403,
      );
      insist(
        actor.role === "student" || isSupervisor(actor),
        "এই কাজের অনুমতি নেই।",
        403,
      );
      return fn(tx);
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
async function studentIdentity(tx: Tx, actor: Actor) {
  const u = await tx.user.findUnique({
    where: { id: actor.id },
    select: { studentBatchName: true, studentRoll: true },
  });
  return tx.batchStudent.findFirst({
    where: {
      courseId: actor.courseId,
      batchName: u?.studentBatchName || "",
      roll: u?.studentRoll || "",
    },
    select: { id: true, name: true, roll: true, batchName: true },
  });
}
export async function accessProgram(
  tx: Tx,
  actor: Actor,
  programId: string,
  lock = false,
) {
  if (lock)
    await tx.$queryRaw`SELECT id FROM incubation_programs WHERE id=${programId} AND course_id=${actor.courseId} FOR UPDATE`;
  const program = await tx.incubationProgram.findUnique({
    where: { id: programId, courseId: actor.courseId },
  });
  insist(program, "প্রোগ্রাম পাওয়া যায়নি।", 404);
  let member = null;
  if (actor.role === "student") {
    insist(
      program.status !== "draft",
      "এই competition এখনো প্রকাশ করা হয়নি।",
      403,
    );
    const student = await studentIdentity(tx, actor);
    member = student
      ? await tx.incubationMember.findUnique({
          where: { programId_studentId: { programId, studentId: student.id } },
          include: { team: true },
        })
      : null;
    insist(
      member &&
        member.team.active &&
        (program.batchNames as string[]).includes(member.batchName),
      "এই প্রোগ্রামের সক্রিয় টিমে আপনাকে যুক্ত করা হয়নি।",
      403,
    );
  } else
    insist(
      isManager(actor) || (program.staffIds as string[]).includes(actor.id),
      "এই প্রোগ্রামের তত্ত্বাবধানের অনুমতি নেই।",
      403,
    );
  return { program, member };
}
export async function audit(
  tx: Tx,
  a: Actor,
  pid: string,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
  reason = "",
) {
  return tx.incubationAudit.create({
    data: {
      courseId: a.courseId,
      programId: pid,
      action,
      entityId,
      actorId: a.id,
      actorName: a.displayName,
      reason,
      before: before ? json(before) : Prisma.DbNull,
      after: after ? json(after) : Prisma.DbNull,
    },
  });
}
const asEntry = (r: IncubationRecord): Entry => ({
  ...r,
  data: r.data as EntryData,
});
async function ledger(
  tx: Tx,
  programId: string,
  replacement?: IncubationRecord,
) {
  const [records, products] = await Promise.all([
    tx.incubationRecord.findMany({ where: { programId, status: "posted" } }),
    tx.incubationCatalog.findMany({ where: { programId, kind: "product" } }),
  ]);
  const all = replacement
    ? [...records.filter((r) => r.id !== replacement.id), replacement]
    : records;
  const computed = calculateLedger(all.map(asEntry), products);
  const pending = await tx.incubationRecord.findMany({
    where: { programId, kind: "transfer", status: "transfer_pending" },
  });
  const reserved: Record<string, number> = {};
  for (const r of pending)
    for (const l of (r.data as EntryData).lines || []) {
      const key = `${r.teamId}|${l.productId}`;
      reserved[key] = (reserved[key] || 0) + scaled(l.quantity, 3);
    }
  for (const [key, q] of Object.entries(reserved))
    insist(
      (computed.stocks[key]?.quantity || 0) >= q,
      "গ্রহণের অপেক্ষায় থাকা টিম হস্তান্তরের জন্য পর্যাপ্ত স্টক রাখতে হবে।",
    );
  return { ...computed, reserved };
}
function financialAccess(
  actor: Actor,
  member: { isLead: boolean; teamId: string } | null,
  teamId: string,
  kind: string,
) {
  if (actor.role !== "student") {
    insist(isSupervisor(actor), "অনুমতি নেই।", 403);
    return;
  }
  insist(
    member?.teamId === teamId,
    "শুধু নিজের টিমের এন্ট্রি দেওয়া যাবে।",
    403,
  );
  if (FINANCIAL_KINDS.includes(kind as RecordKind))
    insist(member.isLead, "শুধু টিম লিডার আর্থিক এন্ট্রি দিতে পারবেন।", 403);
  insist(
    kind !== "fund",
    "ফান্ড প্রদান প্রতিষ্ঠানের অনুমোদিত কর্মী নথিভুক্ত করবেন।",
    403,
  );
}
async function validateData(
  tx: Tx,
  program: IncubationProgram,
  r: Pick<
    IncubationRecord,
    "id" | "teamId" | "targetTeamId" | "date" | "kind"
  > & { data: unknown },
) {
  const d = entryDataSchema.parse(r.data),
    cfg = settingsSchema.parse(program.settings);
  insist(
    validDate(r.date) &&
      r.date >= program.startDate &&
      r.date <= todayDhaka() &&
      (!program.endDate || r.date <= program.endDate),
    "তারিখ প্রোগ্রামের সময়সীমার মধ্যে হতে হবে; ভবিষ্যতের এন্ট্রি দেওয়া যাবে না।",
  );
  const team = await tx.incubationTeam.findFirst({
    where: {
      id: r.teamId,
      programId: program.id,
      ...(r.id === "new" ? { active: true } : {}),
    },
  });
  insist(team, "সক্রিয় টিম নির্বাচন করুন।");
  if (d.voucherId) {
    const asset = await tx.incubationAttachment.findFirst({
      where: {
        id: d.voucherId,
        programId: program.id,
        OR: [
          { teamId: r.teamId },
          { teamId: null },
          ...(r.kind === "transfer" && r.targetTeamId
            ? [{ teamId: r.targetTeamId }]
            : []),
        ],
      },
    });
    insist(asset, "এই টিমের বৈধ ভাউচার নির্বাচন করুন।");
  }
  if (r.kind === "purchase")
    insist(d.voucherId, "কেনার ভাউচার আপলোড বাধ্যতামূলক।");
  if (
    ["supplier_return", "transfer", "damage", "customer_refund"].includes(
      r.kind,
    )
  )
    insist(
      (d.reason || "").trim().length >= 3,
      "ফেরত/নষ্ট/রিফান্ডের কারণ লিখুন।",
    );
  if (
    [
      "purchase",
      "sale",
      "supplier_return",
      "transfer",
      "damage",
      "customer_refund",
    ].includes(r.kind)
  ) {
    insist(d.lines?.length, "অন্তত একটি পণ্য দিন।");
    const prods = await tx.incubationCatalog.findMany({
      where: {
        programId: program.id,
        kind: "product",
        id: { in: d.lines.map((l) => l.productId) },
      },
    });
    for (const l of d.lines) {
      const p = prods.find((p) => p.id === l.productId);
      insist(p, "পণ্য পাওয়া যায়নি।");
      insist(scaled(l.quantity, 3) > 0, "পরিমাণ শূন্য হতে পারবে না।");
      if (r.kind !== "damage") scaled(l.unitPrice);
    }
    if (r.kind === "purchase" && cfg.enforceCategory) {
      const sprint = await tx.incubationSprint.findFirst({
        where: {
          programId: program.id,
          teamId: r.teamId,
          startDate: { lte: r.date },
          endDate: { gte: r.date },
        },
      });
      insist(
        sprint && prods.every((p) => p.parentId === sprint.categoryId),
        "ওই তারিখের নির্ধারিত ক্যাটাগরির পণ্যই কেনা যাবে।",
      );
    }
  }
  if (r.kind === "sale" || d.areaId)
    insist(
      d.areaId &&
        (await tx.incubationCatalog.findFirst({
          where: { id: d.areaId, programId: program.id, kind: "area" },
        })),
      "ব্রড এরিয়া নির্বাচন করুন।",
    );
  if (r.kind === "expense")
    insist(
      cfg.expenseTypes.includes(d.expenseType || ""),
      "খরচের ধরন নির্বাচন করুন।",
    );
  if (["expense", "fund", "repayment", "cash_count"].includes(r.kind))
    scaled(d.amount);
  if (r.kind === "customer_refund")
    insist(
      d.sourceId &&
        (await tx.incubationRecord.findFirst({
          where: {
            id: d.sourceId,
            programId: program.id,
            teamId: r.teamId,
            kind: "sale",
            status: "posted",
            date: { lte: r.date },
          },
        })),
      "এই টিমের মূল বিক্রি নির্বাচন করুন।",
    );
  if (r.kind === "transfer")
    insist(
      r.targetTeamId &&
        r.targetTeamId !== r.teamId &&
        (await tx.incubationTeam.findFirst({
          where: { id: r.targetTeamId, programId: program.id, active: true },
        })),
      "গ্রহণকারী টিম নির্বাচন করুন।",
    );
  const settings = settingsSchema.parse(program.settings);
  if (r.kind === "sale")
    insist(
      !settings.sessionsRequired ||
        (!!d.session && settings.sessions.includes(d.session)),
      "বিক্রির session নির্বাচন করুন।",
    );
  if (d.session && settings.sessions.length)
    insist(
      settings.sessions.includes(d.session),
      "সঠিক session নির্বাচন করুন।",
    );
  if (r.kind === "fgd")
    insist(
      d.findings &&
        d.actions &&
        d.findings
          .slice(0, settings.fgdRequiredCount)
          .filter((v) => v.length >= 3).length === settings.fgdRequiredCount &&
        d.actions
          .slice(0, settings.fgdRequiredCount)
          .filter((v) => v.length >= 3).length === settings.fgdRequiredCount,
      `FGD-তে অন্তত ${settings.fgdRequiredCount}টি finding ও action দিন।`,
    );
  if (r.kind === "insight")
    insist(
      d.segment &&
        d.objections &&
        d.bestArea &&
        (!settings.whyBoughtRequired || d.whyBought),
      "Insights-এর সব তথ্য দিন।",
    );
  if (r.kind === "insight") {
    insist(
      !settings.segments.length || settings.segments.includes(d.segment || ""),
      "সঠিক customer segment নির্বাচন করুন।",
    );
    insist(
      !settings.objections.length ||
        settings.objections.includes(d.objections || ""),
      "সঠিক objection নির্বাচন করুন।",
    );
  }
  return d;
}
export async function overview(actor: Actor, programId?: string) {
  return featureTx(actor, async (tx) => {
    const manager = isManager(actor),
      supervisor = isSupervisor(actor);
    const student =
      actor.role === "student" ? await studentIdentity(tx, actor) : null;
    const programs = await tx.incubationProgram.findMany({
      where: {
        courseId: actor.courseId,
        ...(actor.role === "student"
          ? {
              status: { not: "draft" },
              batchNames: {
                array_contains: student?.batchName
                  ? [student.batchName]
                  : ["__none__"],
              },
            }
          : manager
            ? {}
            : { staffIds: { array_contains: [actor.id] } }),
      },
      orderBy: { createdAt: "desc" },
    });
    const safePrograms = programs.map(({ publicTokenHash, ...p }) =>
      actor.role === "student"
        ? {
            id: p.id,
            competitionId: p.competitionId,
            name: p.name,
            description: p.description,
            startDate: p.startDate,
            endDate: p.endDate,
            status: p.status,
            batchNames: student ? [student.batchName] : [],
          }
        : p,
    );
    if (!programId)
      return {
        programs: safePrograms,
        manager,
        supervisor,
        batches: manager
          ? await tx.batchStudent.findMany({
              where: { courseId: actor.courseId },
              distinct: ["batchName"],
              select: { batchName: true },
            })
          : [],
        staff: manager
          ? await tx.user.findMany({
              where: {
                courseId: actor.courseId,
                role: { in: ["teacher", "admin"] },
                deletedAt: null,
              },
              select: { id: true, displayName: true },
            })
          : [],
      };
    const { program, member } = await accessProgram(tx, actor, programId);
    const teamWhere = member ? { teamId: member.teamId } : {};
    const [
      teams,
      catalog,
      sprints,
      records,
      corrections,
      fields,
      attachments,
      history,
      roster,
      staff,
    ] = await Promise.all([
      tx.incubationTeam.findMany({
        where: { programId, ...(member ? { id: member.teamId } : {}) },
        include: { members: true },
        orderBy: { name: "asc" },
      }),
      tx.incubationCatalog.findMany({
        where: { programId },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
      }),
      tx.incubationSprint.findMany({
        where: { programId, ...teamWhere },
        orderBy: { startDate: "asc" },
      }),
      tx.incubationRecord.findMany({
        where: {
          programId,
          ...(member && !member.isLead
            ? { kind: { in: ["fgd", "insight"] }, enteredBy: actor.id }
            : {}),
          ...(member
            ? {
                OR: [
                  { teamId: member.teamId },
                  { targetTeamId: member.teamId },
                ],
              }
            : {}),
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      tx.incubationCorrection.findMany({
        where: {
          programId,
          ...(member
            ? member.isLead
              ? { record: { teamId: member.teamId } }
              : { requestedBy: actor.id }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      }),
      tx.incubationFieldSession.findMany({
        where: {
          programId,
          ...(member
            ? member.isLead
              ? { teamId: member.teamId }
              : { userId: actor.id }
            : {}),
        },
        include: { pings: { orderBy: { capturedAt: "desc" }, take: 1 } },
        orderBy: { checkIn: "desc" },
      }),
      tx.incubationAttachment.findMany({
        where: {
          programId,
          ...(member
            ? member.isLead
              ? { teamId: member.teamId }
              : { uploadedBy: actor.id }
            : {}),
        },
        select: { id: true, name: true, teamId: true, size: true },
      }),
      tx.incubationAudit.findMany({
        where: {
          programId,
          ...(member
            ? {
                OR: [
                  { actorId: actor.id },
                  {
                    entityId: {
                      in: (
                        await tx.incubationRecord.findMany({
                          where: {
                            programId,
                            teamId: member.teamId,
                            ...(!member.isLead ? { enteredBy: actor.id } : {}),
                          },
                          select: { id: true },
                        })
                      ).map((r) => r.id),
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      }),
      manager
        ? tx.batchStudent.findMany({
            where: {
              courseId: actor.courseId,
              batchName: { in: program.batchNames as string[] },
            },
            select: { id: true, name: true, roll: true, batchName: true },
            orderBy: [{ batchName: "asc" }, { roll: "asc" }],
          })
        : Promise.resolve([]),
      manager
        ? tx.user.findMany({
            where: {
              courseId: actor.courseId,
              role: { in: ["teacher", "admin"] },
              deletedAt: null,
            },
            select: { id: true, displayName: true },
          })
        : Promise.resolve([]),
    ]);
    const batches = manager
      ? await tx.batchStudent.findMany({
          where: { courseId: actor.courseId },
          distinct: ["batchName"],
          select: { batchName: true },
        })
      : [];
    const transferTeams = await tx.incubationTeam.findMany({
      where: { programId, active: true },
      select: { id: true, name: true },
    });
    const fieldCorrections = await tx.incubationFieldCorrection.findMany({
      where: {
        programId,
        ...(member
          ? member.isLead
            ? { session: { teamId: member.teamId } }
            : { requestedBy: actor.id }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    const reportEntries = records.map((r) =>
      member && r.targetTeamId === member.teamId && r.kind === "transfer"
        ? { ...r, teamId: member.teamId, targetTeamId: null, kind: "purchase" }
        : r,
    );
    const computed = await ledger(tx, programId);
    const monitor = issuesFor(
      buildMonitor({
        today: todayDhaka(),
        program: { ...program, settings: settingsSchema.parse(program.settings) },
        teams,
        sprints,
        records,
        sessions: fields,
        pendingCorrections: corrections.filter((c) => c.status === "pending").length,
        pendingFieldCorrections: fieldCorrections.filter((c) => c.status === "pending").length,
      }),
      {
        staff: !member,
        teamId: member?.teamId,
        isLead: member?.isLead,
        userId: actor.id,
      },
    );
    const permittedProducts = new Set(
      member
        ? records
            .flatMap(
              (r) => (r.data as EntryData).lines?.map((l) => l.productId) || [],
            )
            .concat(
              Object.keys(computed.stocks)
                .filter((k) => k.startsWith(member.teamId + "|"))
                .map((k) => k.split("|")[1]),
            )
        : [],
    );
    const permittedCategories = new Set(
      member
        ? [
            ...sprints.map((s) => s.categoryId),
            ...catalog
              .filter((c) => permittedProducts.has(c.id))
              .map((c) => c.parentId),
          ]
        : [],
    );
    return {
      programs: safePrograms,
      program: {
        ...(member
          ? {
              id: program.id,
              competitionId: program.competitionId,
              name: program.name,
              description: program.description,
              startDate: program.startDate,
              endDate: program.endDate,
              status: program.status,
              batchNames: [member.batchName],
              settings: settingsSchema.parse(program.settings),
            }
          : program),
        publicTokenHash: undefined,
        publicEnabled: !!program.publicTokenHash,
      },
      member,
      manager,
      supervisor,
      monitor,
      results: await tx.incubationResult.findFirst({
        where: { programId, withdrawnAt: null },
        orderBy: { publishedAt: "desc" },
        select: { id: true, metric: true, snapshot: true, note: true, publishedAt: true, publishedByName: true },
      }),
      batches,
      teams,
      transferTeams: member && !member.isLead ? [] : transferTeams,
      catalog: member
        ? catalog.filter(
            (c) =>
              (member.isLead &&
                !settingsSchema.parse(program.settings).enforceCategory) ||
              c.kind === "area" ||
              (c.kind === "category"
                ? permittedCategories.has(c.id)
                : permittedProducts.has(c.id) ||
                  permittedCategories.has(c.parentId)),
          )
        : catalog,
      sprints,
      records,
      reportEntries,
      corrections,
      fieldCorrections,
      fields,
      attachments,
      history,
      roster,
      staff,
      groupTemplates: manager
        ? await tx.competitionGroup.findMany({
            where: {
              courseId: actor.courseId,
              batchName: { in: program.batchNames as string[] },
            },
            select: {
              id: true,
              groupName: true,
              batchName: true,
              members: true,
            },
            orderBy: { groupName: "asc" },
          })
        : [],
      ledger: member
        ? {
            reserved: Object.fromEntries(
              Object.entries(computed.reserved).filter(([k]) =>
                k.startsWith(`${member.teamId}|`),
              ),
            ),
            stocks: Object.fromEntries(
              Object.entries(computed.stocks).filter(([k]) =>
                k.startsWith(`${member.teamId}|`),
              ),
            ),
            summaries: computed.summaries.filter(
              (s) => s.teamId === member.teamId,
            ),
          }
        : computed,
      actor: { id: actor.id, name: actor.displayName, role: actor.role },
      state: incubationState(program),
      capabilities: {
        manage: manager,
        finance: !!member?.isLead,
        teamPeople: !!member?.isLead,
      },
    };
  });
}

export async function command(actor: Actor, input: unknown) {
  const body = z
    .object({
      action: text,
      programId: id.optional(),
      payload: z.record(z.string(), z.unknown()),
    })
    .parse(input);
  return featureTx(actor, async (tx) => {
    const p = body.payload,
      manager = isManager(actor);
    if (body.action === "program") {
      insist(manager, "শুধু প্রশাসক প্রোগ্রাম তৈরি/পরিবর্তন করতে পারবেন।", 403);
      const values = z
        .object({
          name: text,
          description: z.string().max(5000),
          startDate: day,
          endDate: day.nullable(),
          batchNames: z.array(text).min(1),
          staffIds: z.array(id),
          settings: settingsSchema,
          status: z.enum(PROGRAM_STATUSES),
        })
        .parse(p);
      insist(
        !values.endDate || values.endDate >= values.startDate,
        "শেষ তারিখ শুরুর পরে হতে হবে।",
      );
      const known = await tx.batchStudent.findMany({
        where: {
          courseId: actor.courseId,
          batchName: { in: values.batchNames },
        },
        select: { batchName: true },
        distinct: ["batchName"],
      });
      insist(
        values.batchNames.every((n) => known.some((b) => b.batchName === n)),
        "বিদ্যমান ব্যাচ নির্বাচন করুন।",
      );
      const staff = await tx.user.count({
        where: {
          id: { in: values.staffIds },
          courseId: actor.courseId,
          role: { in: ["teacher", "admin"] },
          deletedAt: null,
        },
      });
      insist(
        staff === new Set(values.staffIds).size,
        "কোর্সের বৈধ শিক্ষক/প্রশাসক নির্বাচন করুন।",
      );
      const before = body.programId
        ? (await accessProgram(tx, actor, body.programId, true)).program
        : null;
      const reason = String(p.reason || "").trim();
      if (!before)
        insist(
          values.status === "draft" || values.status === "active",
          "নতুন প্রোগ্রাম খসড়া বা সক্রিয় অবস্থায় তৈরি করুন।",
        );
      if (before) {
        insist(
          !isProgramLocked(before.status) || values.status !== before.status,
          lockedMessage(before.status),
          409,
        );
        const transitionError = checkTransition(before.status, values.status, reason);
        insist(!transitionError, transitionError ?? "");
        if (before.status === "active" && values.status === "draft") {
          const used = await tx.incubationRecord.count({ where: { programId: before.id } });
          insist(
            used === 0,
            "এন্ট্রি থাকা প্রোগ্রাম খসড়ায় ফেরানো যায় না। প্রয়োজনে 'হিসাব মেলানো' বা 'বাতিল' করুন।",
          );
        }
      }
      if (before && values.status === "closed" && before.status !== "closed") {
        const balances = await ledger(tx, before.id);
        const unresolved = balances.summaries.some(
          (s) =>
            s.principalOutstanding !== 0 ||
            s.variance !== 0 ||
            s.stockValue !== 0 ||
            (s.cashDifference !== null && s.cashDifference !== 0),
        );
        insist(
          !unresolved || String(p.reason || "").trim().length >= 3,
          "স্টক/মূল ফান্ড/ক্যাশের অসম্পূর্ণ হিসাব স্বীকার করে বন্ধ করার কারণ লিখুন।",
        );
      }
      const result = before
        ? await tx.incubationProgram.update({
            where: { id: before.id },
            // Between two locked states (e.g. closed → archived) only the status moves.
            data:
              isProgramLocked(before.status) && isProgramLocked(values.status)
                ? { status: values.status }
                : { ...values, settings: json(values.settings) },
          })
        : await tx.incubationProgram.create({
            data: {
              ...values,
              courseId: actor.courseId,
              createdBy: actor.id,
              settings: json(values.settings),
              competitionId: (
                await tx.competition.create({
                  data: {
                    courseId: actor.courseId,
                    kind: "business_incubation",
                    title: values.name,
                    description: values.description,
                    batchName: null,
                    schema: [],
                    isActive: values.status === "active",
                    startDate: new Date(values.startDate + "T00:00:00+06:00"),
                    endDate: values.endDate
                      ? new Date(values.endDate + "T23:59:59+06:00")
                      : null,
                  },
                })
              ).id,
            },
          });
      await tx.competition.update({
        where: { id: result.competitionId },
        data: {
          title: result.name,
          description: result.description,
          isActive: result.status === "active",
          startDate: new Date(result.startDate + "T00:00:00+06:00"),
          endDate: result.endDate
            ? new Date(result.endDate + "T23:59:59+06:00")
            : null,
        },
      });
      await audit(
        tx,
        actor,
        result.id,
        !before
          ? "program.created"
          : before.status !== result.status
            ? `program.status.${before.status}>${result.status}`
            : "program.updated",
        result.id,
        before,
        result,
        reason,
      );
      return { id: result.id, competitionId: result.competitionId };
    }
    insist(body.programId, "প্রোগ্রাম নির্বাচন করুন।");
    const { program, member } = await accessProgram(
      tx,
      actor,
      body.programId,
      true,
    );
    // Results are a frozen read of final figures, so they may be published after closing.
    const resultsAction = ["publish_results", "withdraw_results"].includes(body.action);
    insist(
      !isProgramLocked(program.status) || (resultsAction && program.status === "closed"),
      lockedMessage(program.status),
      409,
    );
    const pid = program.id;
    if (["team", "catalog", "sprint", "share"].includes(body.action))
      insist(manager, "প্রশাসকের অনুমতি প্রয়োজন।", 403);
    if (body.action === "team") {
      const v = z
        .object({
          id: id.optional(),
          name: text,
          studentIds: z.array(id).min(1).max(500),
          leadId: id,
          active: z.boolean().default(true),
        })
        .parse(p);
      const students = await tx.batchStudent.findMany({
        where: {
          id: { in: v.studentIds },
          courseId: actor.courseId,
          batchName: { in: program.batchNames as string[] },
        },
        select: { id: true, name: true, roll: true, batchName: true },
      });
      insist(
        students.length === new Set(v.studentIds).size &&
          students.some((s) => s.id === v.leadId),
        "বৈধ সদস্য ও তাদের মধ্য থেকে লিডার নির্বাচন করুন।",
      );
      insist(
        new Set(students.map((s) => s.batchName)).size === 1,
        "একটি টিমে একই ব্যাচের সদস্য নির্বাচন করুন।",
      );
      const before = v.id
        ? await tx.incubationTeam.findFirst({
            where: { id: v.id, programId: pid },
            include: { members: true },
          })
        : null;
      insist(!v.id || before, "টিম পাওয়া যায়নি।");
      if (before)
        insist(
          !(await tx.incubationFieldSession.findFirst({
            where: { teamId: before.id, checkOut: null },
          })),
          "খোলা মাঠ সেশন শেষ করে সদস্য পরিবর্তন করুন।",
        );
      const conflicts = await tx.incubationMember.count({
        where: {
          programId: pid,
          studentId: { in: v.studentIds },
          ...(v.id ? { teamId: { not: v.id } } : {}),
        },
      });
      insist(
        !conflicts,
        "একজন শিক্ষার্থী একই প্রোগ্রামে একাধিক টিমে থাকতে পারবেন না।",
        409,
      );
      if (before?.active && !v.active) {
        const own = (await ledger(tx, pid)).summaries.find((x) => x.teamId === before.id);
        insist(
          !own || (own.stockValue === 0 && own.cash === 0 && own.principalOutstanding === 0),
          "এই টিমের কাছে স্টক, ক্যাশ বা ফেরতযোগ্য ফান্ড আছে। আগে হিসাব মিলিয়ে তারপর টিম নিষ্ক্রিয় করুন।",
          409,
        );
      }
      if (before && before.batchName !== students[0].batchName)
        insist(
          !(await tx.incubationRecord.count({ where: { teamId: before.id } })),
          "লেনদেন থাকা টিমের ব্যাচ বদলানো যাবে না; নতুন টিম তৈরি করুন।",
        );
      const team = before
        ? await tx.incubationTeam.update({
            where: { id: before.id },
            data: {
              name: v.name,
              active: v.active,
              batchName: students[0].batchName,
            },
          })
        : await tx.incubationTeam.create({
            data: {
              name: v.name,
              active: v.active,
              batchName: students[0].batchName,
              programId: pid,
              courseId: actor.courseId,
            },
          });
      // Keep existing member rows (and their ids); only add/remove the difference.
      // Leads are cleared first so the one-lead-per-team index never sees two.
      const keep = new Set(students.map((s) => s.id));
      const existingIds = new Set((before?.members ?? []).map((m) => m.studentId));
      await tx.incubationMember.updateMany({
        where: { teamId: team.id, isLead: true },
        data: { isLead: false },
      });
      await tx.incubationMember.deleteMany({
        where: { teamId: team.id, studentId: { notIn: [...keep] } },
      });
      for (const s of students.filter((x) => existingIds.has(x.id)))
        await tx.incubationMember.updateMany({
          where: { teamId: team.id, studentId: s.id },
          data: { name: s.name, roll: s.roll, batchName: s.batchName },
        });
      await tx.incubationMember.createMany({
        data: students
          .filter((s) => !existingIds.has(s.id))
          .map((s) => ({
            courseId: actor.courseId,
            programId: pid,
            teamId: team.id,
            studentId: s.id,
            name: s.name,
            roll: s.roll,
            batchName: s.batchName,
            isLead: false,
          })),
      });
      await tx.incubationMember.updateMany({
        where: { teamId: team.id, studentId: v.leadId },
        data: { isLead: true },
      });
      await audit(tx, actor, pid, "team.saved", team.id, before, {
        ...team,
        members: students,
        leadId: v.leadId,
      });
      return team;
    }
    if (body.action === "catalog") {
      const v = z
        .object({
          id: id.optional(),
          kind: z.enum(["category", "product", "area"]),
          name: text,
          parentId: id.nullable(),
          variant: z.string().trim().max(100).default(""),
          unit: text,
          fractional: z.boolean(),
          active: z.boolean(),
        })
        .parse(p);
      if (v.kind === "product")
        insist(
          v.parentId &&
            (await tx.incubationCatalog.findFirst({
              where: { id: v.parentId, programId: pid, kind: "category" },
            })),
          "পণ্যের ক্যাটাগরি নির্বাচন করুন।",
        );
      else v.parentId = null;
      if (v.kind !== "product") v.variant = "";
      const duplicate = await tx.incubationCatalog.findFirst({
        where: {
          programId: pid,
          kind: v.kind,
          parentId: v.parentId,
          name: { equals: v.name, mode: "insensitive" },
          variant: { equals: v.variant, mode: "insensitive" },
          id: { not: v.id || "__new__" },
        },
      });
      insist(!duplicate, "একই নাম ও variant-এর আইটেম আগে থেকেই আছে।");
      const before = v.id
        ? await tx.incubationCatalog.findFirst({
            where: { id: v.id, programId: pid },
          })
        : null;
      insist(
        !v.id || (before && before.kind === v.kind),
        "ক্যাটালগ আইটেম পাওয়া যায়নি।",
      );
      if (
        before?.kind === "product" &&
        (before.parentId !== v.parentId ||
          before.unit !== v.unit ||
          before.variant !== v.variant ||
          before.fractional !== v.fractional)
      ) {
        const used = await tx.$queryRaw<
          { used: boolean }[]
        >`SELECT EXISTS(SELECT 1 FROM incubation_records WHERE program_id=${pid} AND (data->'lines') @> ${JSON.stringify([{ productId: before.id }])}::jsonb) AS used`;
        insist(
          !used[0]?.used,
          "লেনদেন থাকা পণ্যের ক্যাটাগরি/একক বদলাবেন না। নতুন পণ্য তৈরি করুন; নাম ও সক্রিয়তা এডিট করা যাবে।",
        );
      }
      const { id: unused, ...data } = v;
      const item = before
        ? await tx.incubationCatalog.update({ where: { id: before.id }, data })
        : await tx.incubationCatalog.create({
            data: { ...data, courseId: actor.courseId, programId: pid },
          });
      await audit(tx, actor, pid, "catalog.saved", item.id, before, item);
      return item;
    }
    if (body.action === "sprint") {
      const v = z
        .object({
          id: id.optional(),
          teamId: id,
          categoryId: id,
          startDate: day,
          endDate: day,
        })
        .parse(p);
      insist(
        v.endDate >= v.startDate &&
          v.startDate >= program.startDate &&
          (!program.endDate || v.endDate <= program.endDate),
        "স্প্রিন্টের তারিখ সঠিক নয়।",
      );
      insist(
        await tx.incubationTeam.findFirst({
          where: { id: v.teamId, programId: pid },
        }),
        "টিম পাওয়া যায়নি।",
      );
      insist(
        await tx.incubationCatalog.findFirst({
          where: {
            id: v.categoryId,
            programId: pid,
            kind: "category",
            active: true,
          },
        }),
        "ক্যাটাগরি পাওয়া যায়নি।",
      );
      insist(
        !(await tx.incubationSprint.findFirst({
          where: {
            programId: pid,
            teamId: v.teamId,
            startDate: { lte: v.endDate },
            endDate: { gte: v.startDate },
            ...(v.id ? { id: { not: v.id } } : {}),
          },
        })),
        "একই টিমের স্প্রিন্টের তারিখ মিলে যাচ্ছে।",
      );
      const before = v.id
        ? await tx.incubationSprint.findFirst({
            where: { id: v.id, programId: pid },
          })
        : null;
      insist(!v.id || before, "স্প্রিন্ট পাওয়া যায়নি।");
      const { id: unused, ...data } = v;
      const item = before
        ? await tx.incubationSprint.update({ where: { id: before.id }, data })
        : await tx.incubationSprint.create({
            data: { ...data, courseId: actor.courseId, programId: pid },
          });
      await audit(tx, actor, pid, "sprint.saved", item.id, before, item);
      return item;
    }
    if (resultsAction) {
      insist(manager, "শুধু প্রশাসক/শিক্ষক ফলাফল প্রকাশ করতে পারবেন।", 403);
      const v = z.object({ note: z.string().trim().max(1000).default("") }).parse(p);
      const current = await tx.incubationResult.findFirst({
        where: { programId: pid, withdrawnAt: null },
        orderBy: { publishedAt: "desc" },
      });
      if (current)
        await tx.incubationResult.update({
          where: { id: current.id },
          data: { withdrawnAt: new Date() },
        });
      if (body.action === "withdraw_results") {
        insist(current, "প্রকাশিত কোনো ফলাফল নেই।", 404);
        await audit(tx, actor, pid, "results.withdrawn", current.id, current, null, v.note);
        return { ok: true };
      }
      const [teams, records, products] = await Promise.all([
        tx.incubationTeam.findMany({
          where: { programId: pid },
          select: { id: true, name: true, batchName: true, active: true },
        }),
        tx.incubationRecord.findMany({ where: { programId: pid, status: "posted" } }),
        tx.incubationCatalog.findMany({ where: { programId: pid, kind: "product" } }),
      ]);
      const report = buildReport(
        records.map((r) => ({ ...r, data: r.data as EntryData })),
        products,
        teams,
      );
      const ranking = rankTeams(
        report.summaries
          .filter((s) => teams.find((t) => t.id === s.teamId)?.active || s.revenue !== 0)
          .map((s) => ({
            teamId: s.teamId,
            teamName: s.teamName,
            revenue: s.revenue,
            netProfit: s.netProfit,
            grossProfit: s.grossProfit,
          })),
      );
      insist(ranking.length, "ফলাফল প্রকাশের মতো কোনো টিম নেই।");
      const snapshot = { metric: RESULT_METRIC, asOf: todayDhaka(), ranking };
      const result = await tx.incubationResult.create({
        data: {
          courseId: actor.courseId,
          programId: pid,
          metric: RESULT_METRIC,
          snapshot: json(snapshot),
          note: v.note,
          publishedBy: actor.id,
          publishedByName: actor.displayName,
        },
      });
      await audit(tx, actor, pid, "results.published", result.id, current, snapshot, v.note);
      return { id: result.id };
    }
    if (body.action === "share") {
      const enable = z.boolean().parse(p.enabled),
        token = enable ? randomBytes(32).toString("hex") : null;
      await tx.incubationProgram.update({
        where: { id: pid },
        data: {
          publicTokenHash: token
            ? createHash("sha256").update(token).digest("hex")
            : null,
        },
      });
      await audit(
        tx,
        actor,
        pid,
        enable ? "report.published" : "report.revoked",
        pid,
        null,
        { enabled: enable },
      );
      return { token };
    }
    if (body.action === "record") {
      insist(
        isIncubationRunning(program),
        "এন্ট্রির জন্য প্রোগ্রাম সক্রিয় থাকতে হবে।",
      );
      const v = z
        .object({
          teamId: id,
          targetTeamId: id.nullable().optional(),
          kind: z.enum([
            "purchase",
            "sale",
            "supplier_return",
            "transfer",
            "customer_refund",
            "damage",
            "expense",
            "fund",
            "repayment",
            "cash_count",
            "fgd",
            "insight",
          ]),
          date: day,
          data: entryDataSchema,
          requestKey: id,
        })
        .parse(p);
      financialAccess(actor, member, v.teamId, v.kind);
      const hash = createHash("sha256").update(JSON.stringify(v)).digest("hex");
      const prior = await tx.incubationRecord.findUnique({
        where: {
          programId_enteredBy_requestKey: {
            programId: pid,
            enteredBy: actor.id,
            requestKey: v.requestKey,
          },
        },
      });
      if (prior) {
        insist(
          prior.requestHash === hash,
          "একই request দিয়ে ভিন্ন ডাটা দেওয়া যাবে না।",
          409,
        );
        return prior;
      }
      const assigned = await tx.incubationSprint.findFirst({
        where: {
          programId: pid,
          teamId: v.teamId,
          startDate: { lte: v.date },
          endDate: { gte: v.date },
        },
      });
      const d = await validateData(tx, program, {
        ...v,
        targetTeamId: v.targetTeamId || null,
        id: "new",
        data: json({
          ...v.data,
          ...(["fgd", "insight"].includes(v.kind)
            ? { categoryId: assigned?.categoryId }
            : {}),
        }),
      });
      const late =
        actor.role === "student" &&
        FINANCIAL_KINDS.includes(v.kind) &&
        (isLate(v.date) || v.kind === "repayment");
      if (late)
        insist(
          (d.reason || "").trim().length >= 3,
          "পুরোনো তারিখে জমা দেওয়ার কারণ লিখুন।",
        );
      const record = await tx.incubationRecord.create({
        data: {
          ...v,
          data: json(d),
          courseId: actor.courseId,
          programId: pid,
          enteredBy: actor.id,
          enteredByName: actor.displayName,
          requestHash: hash,
          status: late
            ? "pending"
            : v.kind === "transfer"
              ? "transfer_pending"
              : "posted",
        },
      });
      if (record.status === "posted" || record.status === "transfer_pending")
        await ledger(tx, pid);
      await audit(tx, actor, pid, "record.created", record.id, null, record);
      return record;
    }
    if (body.action === "review_late" || body.action === "accept_transfer") {
      const v = z
        .object({
          recordId: id,
          approve: z.boolean(),
          reason: text,
          voucherId: id.optional(),
        })
        .parse(p);
      const r = await tx.incubationRecord.findFirst({
        where: { id: v.recordId, programId: pid },
      });
      insist(r, "রেকর্ড পাওয়া যায়নি।", 404);
      if (body.action === "review_late") {
        insist(
          actor.role !== "student" && isSupervisor(actor),
          "শিক্ষক/অ্যাডমিনের অনুমতি প্রয়োজন।",
          403,
        );
        insist(
          r.status === "pending",
          "অনুরোধটি ইতিমধ্যে পর্যালোচিত হয়েছে।",
          409,
        );
      } else {
        insist(
          r.status === "transfer_pending",
          "হস্তান্তর ইতিমধ্যে পর্যালোচিত হয়েছে।",
          409,
        );
        insist(
          manager || (member?.isLead && member.teamId === r.targetTeamId),
          "গ্রহণকারী টিম লিডারের অনুমতি প্রয়োজন।",
          403,
        );
        if (v.approve)
          insist(
            v.voucherId &&
              (await tx.incubationAttachment.findFirst({
                where: {
                  id: v.voucherId,
                  programId: pid,
                  OR: [{ teamId: r.targetTeamId }, { teamId: null }],
                },
              })),
            "হস্তান্তরের ভাউচার/প্রমাণ আপলোড করুন।",
          );
      }
      if (v.approve) await validateData(tx, program, r);
      const changed = await tx.incubationRecord.update({
        where: { id: r.id },
        data: {
          status: v.approve
            ? body.action === "review_late" && r.kind === "transfer"
              ? "transfer_pending"
              : "posted"
            : "rejected",
          reviewedBy: actor.id,
          data: json({
            ...(r.data as object),
            ...(v.voucherId ? { voucherId: v.voucherId } : {}),
          }),
        },
      });
      if (changed.status === "posted" || changed.status === "transfer_pending")
        await ledger(tx, pid);
      await audit(tx, actor, pid, body.action, r.id, r, changed, v.reason);
      return changed;
    }
    if (body.action === "correct") {
      const v = z
        .object({
          recordId: id,
          version: z.number().int().positive(),
          date: day,
          data: entryDataSchema,
          reason: text,
          void: z.boolean().default(false),
        })
        .parse(p);
      const r = await tx.incubationRecord.findFirst({
        where: { id: v.recordId, programId: pid, status: "posted" },
      });
      insist(r, "কার্যকর রেকর্ড পাওয়া যায়নি।", 404);
      insist(
        r.version === v.version,
        "রেকর্ড পরিবর্তিত হয়েছে। রিফ্রেশ করে আবার দিন।",
        409,
      );
      financialAccess(actor, member, r.teamId, r.kind);
      if (
        actor.role === "student" &&
        !FINANCIAL_KINDS.includes(r.kind as RecordKind)
      )
        insist(
          r.enteredBy === actor.id,
          "শুধু নিজের ব্যক্তিগত এন্ট্রি সংশোধন করতে পারবেন।",
          403,
        );
      const proposed = {
        date: v.date,
        data: v.data,
        status: v.void ? "void" : "posted",
      };
      await validateData(tx, program, {
        ...r,
        date: v.date,
        data: json(v.data),
      });
      if (manager) {
        const changed = await tx.incubationRecord.update({
          where: { id: r.id },
          data: {
            date: v.date,
            data: json(v.data),
            status: proposed.status,
            version: { increment: 1 },
          },
        });
        await ledger(tx, pid);
        await audit(
          tx,
          actor,
          pid,
          "record.admin_corrected",
          r.id,
          r,
          changed,
          v.reason,
        );
        return changed;
      }
      insist(
        !(await tx.incubationCorrection.findFirst({
          where: { recordId: r.id, status: "pending" },
        })),
        "এই রেকর্ডের সংশোধন অনুরোধ অপেক্ষায় আছে।",
        409,
      );
      const request = await tx.incubationCorrection.create({
        data: {
          courseId: actor.courseId,
          programId: pid,
          recordId: r.id,
          expectedVersion: r.version,
          before: json(r),
          proposed: json(proposed),
          reason: v.reason,
          requestedBy: actor.id,
          requestedByName: actor.displayName,
        },
      });
      await audit(
        tx,
        actor,
        pid,
        "correction.requested",
        r.id,
        r,
        proposed,
        v.reason,
      );
      return request;
    }
    if (body.action === "bulk_correct") {
      insist(manager, "শুধু প্রশাসক শিট এডিট করতে পারবেন।", 403);
      const v = z
        .object({
          reason: z.string().trim().min(3).max(2000),
          changes: z
            .array(
              z.object({
                recordId: id,
                version: z.number().int().positive(),
                date: day,
                data: entryDataSchema,
              }),
            )
            .min(1)
            .max(200),
        })
        .parse(p);
      insist(
        new Set(v.changes.map((c) => c.recordId)).size === v.changes.length,
        "একই রেকর্ড একাধিকবার দেওয়া হয়েছে।",
      );
      for (const c of v.changes) {
        const old = await tx.incubationRecord.findFirst({
          where: { id: c.recordId, programId: pid, status: "posted" },
        });
        insist(
          old && old.version === c.version,
          "কোনো রেকর্ড ইতিমধ্যে পরিবর্তিত হয়েছে; পুরো শিট রিফ্রেশ করুন।",
          409,
        );
        await validateData(tx, program, { ...old, date: c.date, data: c.data });
        const changed = await tx.incubationRecord.update({
          where: { id: old.id },
          data: { date: c.date, data: json(c.data), version: { increment: 1 } },
        });
        await audit(
          tx,
          actor,
          pid,
          "record.sheet_corrected",
          old.id,
          old,
          changed,
          v.reason,
        );
      }
      await ledger(tx, pid);
      return { updated: v.changes.length };
    }
    if (body.action === "review_correction") {
      insist(
        actor.role !== "student" && isSupervisor(actor),
        "শিক্ষক/অ্যাডমিনের অনুমতি প্রয়োজন।",
        403,
      );
      const v = z.object({ id, approve: z.boolean(), reason: text }).parse(p);
      const req = await tx.incubationCorrection.findFirst({
        where: { id: v.id, programId: pid },
        include: { record: true },
      });
      insist(
        req && req.status === "pending",
        "অনুরোধটি ইতিমধ্যে পর্যালোচিত হয়েছে।",
        409,
      );
      if (v.approve) {
        insist(
          req.record.version === req.expectedVersion,
          "মূল রেকর্ড পরিবর্তিত হয়েছে; এই অনুরোধ বাতিল করে নতুন অনুরোধ দিন।",
          409,
        );
        const proposed = req.proposed as unknown as {
          date: string;
          data: EntryData;
          status: string;
        };
        await validateData(tx, program, {
          ...req.record,
          date: proposed.date,
          data: json(proposed.data),
        });
        const changed = await tx.incubationRecord.update({
          where: { id: req.recordId },
          data: {
            date: proposed.date,
            data: json(proposed.data),
            status: proposed.status,
            version: { increment: 1 },
          },
        });
        await ledger(tx, pid);
        await audit(
          tx,
          actor,
          pid,
          "correction.applied",
          req.recordId,
          req.record,
          changed,
          req.reason,
        );
      }
      if (!v.approve)
        await audit(tx, actor, pid, "correction.rejected", req.recordId, req.record, null, v.reason);
      return tx.incubationCorrection.update({
        where: { id: req.id },
        data: {
          status: v.approve ? "approved" : "rejected",
          reviewedBy: actor.id,
          reviewNote: v.reason,
          reviewedAt: new Date(),
        },
      });
    }
    throw new IncubationError("কাজের ধরন সঠিক নয়।");
  });
}
