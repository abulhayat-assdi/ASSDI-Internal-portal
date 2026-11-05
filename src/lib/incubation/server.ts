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
import { withCourseContext } from "@/lib/db";
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
    findings: z.array(text).length(3).optional(),
    actions: z.array(text).length(3).optional(),
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
  })
  .strict();
export const isManager = (a: JWTPayload) =>
  hasPermission(a.role, a.permissions, "admin_incubation");
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
    const student = await studentIdentity(tx, actor);
    member = student
      ? await tx.incubationMember.findUnique({
          where: { programId_studentId: { programId, studentId: student.id } },
          include: { team: true },
        })
      : null;
    insist(
      member && member.team.active,
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
async function audit(
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
  if (r.kind === "fgd")
    insist(
      d.findings?.length === 3 && d.actions?.length === 3,
      "FGD-তে ৩টি finding ও ৩টি action দিন।",
    );
  if (r.kind === "insight")
    insist(
      d.segment && d.objections && d.whyBought && d.bestArea,
      "Insights-এর সব তথ্য দিন।",
    );
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
    const safePrograms = programs.map(({ publicTokenHash, ...p }) => p);
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
          ...(member ? { record: { teamId: member.teamId } } : {}),
        },
        orderBy: { createdAt: "desc" },
      }),
      tx.incubationFieldSession.findMany({
        where: { programId, ...(member ? { userId: actor.id } : {}) },
        include: { pings: { orderBy: { capturedAt: "desc" }, take: 1 } },
        orderBy: { checkIn: "desc" },
      }),
      tx.incubationAttachment.findMany({
        where: {
          programId,
          ...(member
            ? { OR: [{ teamId: member.teamId }, { uploadedBy: actor.id }] }
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
                          where: { programId, teamId: member.teamId },
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
      where: { programId, ...(member ? { requestedBy: actor.id } : {}) },
      orderBy: { createdAt: "desc" },
    });
    const reportEntries = records.map((r) =>
      member && r.targetTeamId === member.teamId && r.kind === "transfer"
        ? { ...r, teamId: member.teamId, targetTeamId: null, kind: "purchase" }
        : r,
    );
    const computed = await ledger(tx, programId);
    return {
      programs: safePrograms,
      program: {
        ...program,
        publicTokenHash: undefined,
        publicEnabled: !!program.publicTokenHash,
      },
      member,
      manager,
      supervisor,
      batches,
      teams,
      transferTeams,
      catalog,
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
      ledger: member
        ? {
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
      actor: { id: actor.id, name: actor.displayName },
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
          status: z.enum(["draft", "active", "closing", "closed", "archived"]),
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
            data: { ...values, settings: json(values.settings) },
          })
        : await tx.incubationProgram.create({
            data: {
              ...values,
              courseId: actor.courseId,
              createdBy: actor.id,
              settings: json(values.settings),
            },
          });
      await audit(
        tx,
        actor,
        result.id,
        before ? "program.updated" : "program.created",
        result.id,
        before,
        result,
        String(p.reason || ""),
      );
      return { id: result.id };
    }
    insist(body.programId, "প্রোগ্রাম নির্বাচন করুন।");
    const { program, member } = await accessProgram(
      tx,
      actor,
      body.programId,
      true,
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
      await tx.incubationMember.deleteMany({ where: { teamId: team.id } });
      await tx.incubationMember.createMany({
        data: students.map((s) => ({
          courseId: actor.courseId,
          programId: pid,
          teamId: team.id,
          studentId: s.id,
          name: s.name,
          roll: s.roll,
          batchName: s.batchName,
          isLead: s.id === v.leadId,
        })),
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
        program.status === "active",
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
