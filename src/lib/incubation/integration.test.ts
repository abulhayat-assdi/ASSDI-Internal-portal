import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { startIncubationTestDatabase } from "../../../test/incubation-database";
import type { Actor } from "./server";
import { todayDhaka } from "./domain";
import { buildReport } from "./report";
import { execFileSync } from "node:child_process";
import path from "node:path";
let fixture: Awaited<ReturnType<typeof startIncubationTestDatabase>>,
  prisma: (typeof import("@/lib/db"))["prisma"],
  api: typeof import("./server"),
  field: typeof import("./field");
let programId = "",
  teamA = "",
  teamB = "",
  product = "",
  area = "",
  saleId = "",
  purchaseId = "";
const manager: Actor = {
  id: "manager",
  email: "manager@test.local",
  displayName: "Manager",
  role: "admin",
  courseId: "course-a",
};
const lead: Actor = {
  id: "lead",
  email: "lead@test.local",
  displayName: "Lead",
  role: "student",
  courseId: "course-a",
};
const member: Actor = {
  id: "member",
  email: "member@test.local",
  displayName: "Member",
  role: "student",
  courseId: "course-a",
};
const target: Actor = {
  id: "target",
  email: "target@test.local",
  displayName: "Target",
  role: "student",
  courseId: "course-a",
};
const settings = {
  sprintDays: 3,
  enforceCategory: false,
  maxFieldHours: null,
  trackingMinutes: 5,
  retentionDays: 30,
  expenseTypes: ["Transport"],
};
const send = (actor: Actor, action: string, payload: Record<string, unknown>) =>
  api.command(actor, { action, programId, payload }) as Promise<any>;
const record = (
  actor: Actor,
  kind: string,
  data: unknown,
  extra: Record<string, unknown> = {},
) =>
  send(actor, "record", {
    teamId: teamA,
    kind,
    date: todayDhaka(),
    data,
    requestKey: crypto.randomUUID(),
    ...extra,
  });
const line = (q: string, price = "100") => ({
  productId: product,
  quantity: q,
  unitPrice: price,
});
beforeAll(async () => {
  fixture = await startIncubationTestDatabase();
  process.env.DATABASE_URL = fixture.url;
  prisma = (await import("@/lib/db")).prisma;
  api = await import("./server");
  field = await import("./field");
  await prisma.course.createMany({
    data: [
      {
        id: "course-a",
        slug: "incubation",
        name: "Incubation Test",
        settings: { features: { business_incubation: true } },
      },
      {
        id: "course-b",
        slug: "other",
        name: "Other",
        settings: { features: { business_incubation: true } },
      },
    ],
  });
  await prisma.batch.create({
    data: { id: "batch-a", courseId: "course-a", name: "Batch 1" },
  });
  for (const [id, roll] of [
    ["lead", "1"],
    ["member", "2"],
    ["target", "3"],
  ]) {
    await prisma.user.create({
      data: {
        id,
        courseId: "course-a",
        email: `${id}@test.local`,
        displayName: id,
        passwordHash: "unused",
        role: "student",
        studentBatchName: "Batch 1",
        studentRoll: roll,
      },
    });
    await prisma.batchStudent.create({
      data: {
        id: `s-${id}`,
        courseId: "course-a",
        batchId: "batch-a",
        batchName: "Batch 1",
        roll,
        name: id,
      },
    });
  }
  await prisma.user.create({
    data: {
      id: manager.id,
      courseId: "course-a",
      email: manager.email,
      displayName: "Manager",
      passwordHash: "unused",
      role: "admin",
    },
  });
  const p = (await api.command(manager, {
    action: "program",
    payload: {
      name: "Market Lab",
      description: "",
      startDate: "2026-01-01",
      endDate: null,
      batchNames: ["Batch 1"],
      staffIds: [],
      settings,
      status: "active",
    },
  })) as any;
  programId = p.id;
  teamA = (
    await send(manager, "team", {
      name: "Team A",
      studentIds: ["s-lead", "s-member"],
      leadId: "s-lead",
      active: true,
    })
  ).id;
  teamB = (
    await send(manager, "team", {
      name: "Team B",
      studentIds: ["s-target"],
      leadId: "s-target",
      active: true,
    })
  ).id;
  const category = (
    await send(manager, "catalog", {
      kind: "category",
      name: "Food",
      parentId: null,
      unit: "piece",
      fractional: false,
      active: true,
    })
  ).id;
  product = (
    await send(manager, "catalog", {
      kind: "product",
      name: "Product",
      parentId: category,
      unit: "piece",
      fractional: false,
      active: true,
    })
  ).id;
  area = (
    await send(manager, "catalog", {
      kind: "area",
      name: "Broad Area",
      parentId: null,
      unit: "piece",
      fractional: false,
      active: true,
    })
  ).id;
  await prisma.incubationAttachment.createMany({
    data: [
      {
        id: "voucher-a",
        courseId: "course-a",
        programId,
        teamId: teamA,
        uploadedBy: "lead",
        name: "voucher.jpg",
        mime: "image/jpeg",
        size: 100,
        path: "incubation/test-a.jpg",
      },
      {
        id: "voucher-b",
        courseId: "course-a",
        programId,
        teamId: teamB,
        uploadedBy: "target",
        name: "handover.jpg",
        mime: "image/jpeg",
        size: 100,
        path: "incubation/test-b.jpg",
      },
    ],
  });
}, 60000);
afterAll(async () => {
  await prisma?.$disconnect();
  await fixture?.stop();
});
describe("real migration and transactional incubation workflows", () => {
  it("applies real empty feature tables and their RLS policies", async () => {
    const policies = await fixture.db.query(
      "SELECT tablename FROM pg_policies WHERE tablename LIKE 'incubation_%'",
    );
    expect(policies.rows).toHaveLength(14);
    expect(await prisma.incubationRecord.count()).toBe(0);
  });
  it("requires a purchase voucher and restricts financial entries to the lead", async () => {
    await expect(
      record(lead, "purchase", { lines: [line("10")] }),
    ).rejects.toThrow();
    await expect(
      record(member, "purchase", {
        lines: [line("10")],
        voucherId: "voucher-a",
      }),
    ).rejects.toThrow();
  });
  it("commits funding and purchases, then deduplicates safe retries", async () => {
    await record(manager, "fund", { amount: "5000" });
    const payload = {
      teamId: teamA,
      kind: "purchase",
      date: todayDhaka(),
      data: { lines: [line("10")], voucherId: "voucher-a" },
      requestKey: "purchase-once",
    };
    const a = await send(lead, "record", payload),
      b = await send(lead, "record", payload);
    purchaseId = a.id;
    expect(a.id).toBe(b.id);
    await expect(
      send(lead, "record", {
        ...payload,
        data: { ...payload.data, lines: [line("11")] },
      }),
    ).rejects.toThrow();
  });
  it("rolls back a failed oversale and posts valid sales", async () => {
    await expect(
      record(lead, "sale", { lines: [line("6"), line("6")], areaId: area }),
    ).rejects.toThrow();
    expect(
      await prisma.incubationRecord.count({ where: { kind: "sale" } }),
    ).toBe(0);
    saleId = (
      await record(lead, "sale", { lines: [line("4", "150")], areaId: area })
    ).id;
  });
  it("does not post an old submission until reviewed", async () => {
    const r = await record(
      lead,
      "expense",
      { amount: "50", expenseType: "Transport", reason: "Forgot report" },
      { date: "2026-01-02" },
    );
    expect(r.status).toBe("pending");
    await send(manager, "review_late", {
      recordId: r.id,
      approve: true,
      reason: "Evidence checked",
    });
    expect(
      (await prisma.incubationRecord.findUnique({ where: { id: r.id } }))
        ?.status,
    ).toBe("posted");
    await expect(
      send(manager, "review_late", {
        recordId: r.id,
        approve: true,
        reason: "Again",
      }),
    ).rejects.toThrow();
  });
  it("keeps old values until correction approval and retains revisions", async () => {
    const original = await prisma.incubationRecord.findUniqueOrThrow({
      where: { id: saleId },
    });
    const request = await send(lead, "correct", {
      recordId: saleId,
      version: 1,
      date: original.date,
      data: { lines: [line("3", "150")], areaId: area },
      reason: "Quantity typo",
      void: false,
    });
    expect(
      (
        await prisma.incubationRecord.findUniqueOrThrow({
          where: { id: saleId },
        })
      ).version,
    ).toBe(1);
    await send(manager, "review_correction", {
      id: request.id,
      approve: true,
      reason: "Receipt verified",
    });
    expect(
      (
        await prisma.incubationRecord.findUniqueOrThrow({
          where: { id: saleId },
        })
      ).version,
    ).toBe(2);
    expect(
      await prisma.incubationAudit.count({
        where: { entityId: saleId, action: "correction.applied" },
      }),
    ).toBe(1);
  });
  it("atomically links another team's return and purchase upon acceptance", async () => {
    const r = await record(
      lead,
      "transfer",
      { lines: [line("2")], reason: "Category finished" },
      { targetTeamId: teamB },
    );
    expect(r.status).toBe("transfer_pending");
    await expect(
      send(lead, "accept_transfer", {
        recordId: r.id,
        approve: true,
        reason: "Take",
      }),
    ).rejects.toThrow();
    await send(target, "accept_transfer", {
      recordId: r.id,
      approve: true,
      reason: "Goods received",
      voucherId: "voucher-b",
    });
    const b = (await api.overview(target, programId)) as any;
    expect(b.ledger.stocks[`${teamB}|${product}`].quantity).toBe(2000);
    expect(b.ledger.summaries[0].cash).toBe(-20000);
    const recipientReport = buildReport(b.reportEntries, b.catalog, b.teams);
    expect(
      recipientReport.inventory.find((s) => s.teamId === teamB)?.quantity,
    ).toBe(2000);
    expect(recipientReport.summaries[0].purchases).toBe(20000);
    expect(recipientReport.summaries[0].cash).toBe(-20000);
  });
  it("rejects cross-course access and gives teachers full course management", async () => {
    await expect(
      api.overview({ ...manager, courseId: "course-b" }, programId),
    ).rejects.toThrow();
    const teacherBundle = await api.overview(
      { ...manager, role: "teacher", permissions: [] },
      programId,
    );
    expect(teacherBundle.manager).toBe(true);
  });
  it("publishes only an allowlisted public report and revokes links", async () => {
    const { token } = await send(manager, "share", { enabled: true });
    const report = await (
      await import("./public")
    ).publicReport("course-a", token);
    expect(report.summaries).toHaveLength(2);
    const data = JSON.stringify(report);
    for (const word of [
      "voucher-a",
      "password",
      "latitude",
      "requestedBy",
      "cashDifference",
    ])
      expect(data).not.toContain(word);
    await send(manager, "share", { enabled: false });
    await expect(
      (await import("./public")).publicReport("course-a", token),
    ).rejects.toThrow();
  });
  it("starts and ends a member's GPS field session, preventing overlapping custody", async () => {
    const position = {
      latitude: 23.8,
      longitude: 90.4,
      accuracy: 15,
      capturedAt: new Date().toISOString(),
    };
    const a = await field.fieldCommand(lead, {
      action: "checkin",
      programId,
      position,
      areaId: area,
      carried: [{ productId: product, quantity: "4" }],
    });
    expect(a.session.checkOut).toBeNull();
    await expect(
      field.fieldCommand(member, {
        action: "checkin",
        programId,
        position,
        areaId: area,
        carried: [{ productId: product, quantity: "4" }],
      }),
    ).rejects.toThrow();
    const end = await field.fieldCommand(lead, {
      action: "checkout",
      programId,
      position: { ...position, capturedAt: new Date().toISOString() },
      areaId: area,
      steps: 400,
    });
    expect(end.session.checkOut).not.toBeNull();
  });
  it("reviews individual field corrections without editing recorded coordinates", async () => {
    const session = await prisma.incubationFieldSession.findFirstOrThrow({
      where: { userId: lead.id, checkOut: { not: null } },
    });
    const proposed = {
      checkIn: session.checkIn.toISOString(),
      checkOut: session.checkOut!.toISOString(),
      startAreaId: area,
      endAreaId: area,
      steps: 999,
    };
    const request = (await field.fieldCorrectionCommand(lead, {
      action: "field_correct",
      programId,
      payload: {
        sessionId: session.id,
        version: session.version,
        proposed,
        reason: "Pedometer typo",
      },
    })) as any;
    expect(
      (
        await prisma.incubationFieldSession.findUniqueOrThrow({
          where: { id: session.id },
        })
      ).steps,
    ).toBe(400);
    await field.fieldCorrectionCommand(manager, {
      action: "field_review",
      programId,
      payload: { id: request.id, approve: true, reason: "Proof checked" },
    });
    expect(
      await prisma.incubationFieldSession.findUniqueOrThrow({
        where: { id: session.id },
      }),
    ).toMatchObject({ steps: 999, version: 2 });
  });
  it("bulk sheet edits are atomic and version checked", async () => {
    const expense = await record(manager, "expense", {
      amount: "2",
      expenseType: "Transport",
    });
    const sale = await prisma.incubationRecord.findUniqueOrThrow({
      where: { id: saleId },
    });
    await expect(
      send(manager, "bulk_correct", {
        reason: "Batch edit",
        changes: [
          {
            recordId: expense.id,
            version: 1,
            date: expense.date,
            data: { amount: "3", expenseType: "Transport" },
          },
          {
            recordId: saleId,
            version: sale.version,
            date: sale.date,
            data: { lines: [line("99", "150")], areaId: area },
          },
        ],
      }),
    ).rejects.toThrow();
    expect(
      (
        await prisma.incubationRecord.findUniqueOrThrow({
          where: { id: expense.id },
        })
      ).version,
    ).toBe(1);
    await send(manager, "bulk_correct", {
      reason: "Verified batch",
      changes: [
        {
          recordId: expense.id,
          version: 1,
          date: expense.date,
          data: { amount: "3", expenseType: "Transport" },
        },
      ],
    });
    expect(
      (
        await prisma.incubationRecord.findUniqueOrThrow({
          where: { id: expense.id },
        })
      ).version,
    ).toBe(2);
  });
  it("pending handovers reserve source stock until accepted/rejected", async () => {
    const r = await record(
      lead,
      "transfer",
      { lines: [line("4")], reason: "Reserve handover" },
      { targetTeamId: teamB },
    );
    const scoped = await api.overview(lead, programId);
    expect(scoped.ledger?.reserved[teamA + "|" + product]).toBe(4000);
    expect(
      Object.keys(scoped.ledger?.reserved || {}).every((k) =>
        k.startsWith(teamA + "|"),
      ),
    ).toBe(true);
    await expect(
      record(lead, "sale", { lines: [line("2", "150")], areaId: area }),
    ).rejects.toThrow();
    await send(target, "accept_transfer", {
      recordId: r.id,
      approve: false,
      reason: "Handover cancelled",
    });
  });
  it("concurrent sale requests cannot oversell the same stock", async () => {
    const results = await Promise.allSettled([
      record(lead, "sale", { lines: [line("4", "150")], areaId: area }),
      record(lead, "sale", { lines: [line("4", "150")], areaId: area }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("replacing the lead immediately removes posting access", async () => {
    await send(manager, "team", {
      id: teamA,
      name: "Team A",
      studentIds: ["s-lead", "s-member"],
      leadId: "s-member",
      active: true,
    });
    await expect(
      record(lead, "expense", { amount: "1", expenseType: "Transport" }),
    ).rejects.toThrow();
  });
  it("keeps roles per program and blocks drafts, ended entries and inactive teams", async () => {
    const created = (await api.command(manager, {
      action: "program",
      payload: {
        name: "Independent program",
        description: "",
        startDate: todayDhaka(),
        endDate: null,
        batchNames: ["Batch 1"],
        staffIds: [],
        status: "active",
        settings,
      },
    })) as any;
    const original = await api.overview(lead, programId);
    const studentRow = await prisma.batchStudent.findUniqueOrThrow({
      where: { id: "s-lead" },
    });
    // Use the real roster batch rather than a global roll-based group.
    await prisma.incubationProgram.update({
      where: { id: created.id },
      data: { batchNames: [studentRow.batchName] },
    });
    const newTeam = (await api.command(manager, {
      action: "team",
      programId: created.id,
      payload: {
        name: "Independent team",
        studentIds: [studentRow.id],
        leadId: studentRow.id,
        active: true,
      },
    })) as any;
    expect(original.member?.isLead).toBe(false);
    expect((await api.overview(lead, created.id)).member?.isLead).toBe(true);
    await prisma.incubationTeam.update({
      where: { id: newTeam.id },
      data: { active: false },
    });
    await expect(api.overview(lead, created.id)).rejects.toThrow();
    await prisma.incubationTeam.update({
      where: { id: newTeam.id },
      data: { active: true },
    });
    await prisma.incubationProgram.update({
      where: { id: created.id },
      data: { status: "draft" },
    });
    await expect(api.overview(lead, created.id)).rejects.toThrow();
    await prisma.incubationProgram.update({
      where: { id: created.id },
      data: {
        status: "active",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      },
    });
    await expect(
      api.command(lead, {
        action: "record",
        programId: created.id,
        payload: {
          teamId: newTeam.id,
          kind: "expense",
          date: "2026-01-01",
          requestKey: "ended-rejected",
          data: { amount: "1", expenseType: "Transport" },
        },
      }),
    ).rejects.toThrow();
    await prisma.incubationProgram.update({
      where: { id: created.id },
      data: { endDate: null, batchNames: ["Revoked batch"] },
    });
    await expect(api.overview(lead, created.id)).rejects.toThrow();
  });
  it("follows the lifecycle state machine and locks closed, archived and cancelled programs", async () => {
    const base = {
      name: "Lifecycle program",
      description: "",
      startDate: todayDhaka(),
      endDate: null,
      batchNames: ["Batch 1"],
      staffIds: [],
      settings,
    };
    await expect(
      api.command(manager, { action: "program", payload: { ...base, status: "closed" } }),
    ).rejects.toThrow(/Draft or Active/);
    const created = (await api.command(manager, {
      action: "program",
      payload: { ...base, status: "draft" },
    })) as any;
    const save = (status: string, reason?: string, extra: Record<string, unknown> = {}) =>
      api.command(manager, {
        action: "program",
        programId: created.id,
        payload: { ...base, ...extra, status, ...(reason ? { reason } : {}) },
      });
    await save("active");
    // Skipping straight from active to archived is not a valid move.
    await expect(save("archived")).rejects.toThrow(/directly/);
    await save("closed");
    const teamPayload = {
      name: "Late team",
      studentIds: ["s-target"],
      leadId: "s-target",
      active: true,
    };
    await expect(
      api.command(manager, { action: "team", programId: created.id, payload: teamPayload }),
    ).rejects.toThrow(/nothing can be changed/);
    await expect(
      api.command(manager, {
        action: "catalog",
        programId: created.id,
        payload: { kind: "area", name: "X", parentId: null, unit: "piece", fractional: false, active: true },
      }),
    ).rejects.toThrow(/nothing can be changed/);
    // A locked program cannot be edited by re-saving it with the same status.
    await expect(save("closed", undefined, { name: "Renamed" })).rejects.toThrow(/nothing can be changed/);
    await save("archived");
    expect(
      (await prisma.incubationProgram.findUniqueOrThrow({ where: { id: created.id } })).name,
    ).toBe("Lifecycle program");
    // Reopening needs a reason and is audited.
    await expect(save("closed")).rejects.toThrow(/reason/);
    await save("closed", "Correcting a missed sale");
    await save("closing", "Correcting a missed sale");
    await api.command(manager, { action: "team", programId: created.id, payload: teamPayload });
    const audit = await prisma.incubationAudit.findMany({
      where: { programId: created.id, action: { startsWith: "program.status." } },
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map((a) => a.action)).toEqual([
      "program.status.draft>active",
      "program.status.active>closed",
      "program.status.closed>archived",
      "program.status.archived>closed",
      "program.status.closed>closing",
    ]);
    expect(audit[3].reason).toBe("Correcting a missed sale");
  });

  it("re-saving a team keeps member ids, and a team holding money or stock cannot be deactivated", async () => {
    const before = await prisma.incubationMember.findMany({ where: { teamId: teamA }, orderBy: { studentId: "asc" } });
    const lead = before.find((m) => m.isLead)!;
    const payload = { id: teamA, name: "Team A", studentIds: before.map((m) => m.studentId), leadId: lead.studentId };
    await api.command(manager, { action: "team", programId, payload: { ...payload, active: true } });
    const after = await prisma.incubationMember.findMany({ where: { teamId: teamA }, orderBy: { studentId: "asc" } });
    expect(after.map((m) => [m.id, m.studentId, m.isLead])).toEqual(before.map((m) => [m.id, m.studentId, m.isLead]));
    await expect(
      api.command(manager, { action: "team", programId, payload: { ...payload, active: false } }),
    ).rejects.toThrow(/deactivating/);
    expect((await prisma.incubationTeam.findUniqueOrThrow({ where: { id: teamA } })).active).toBe(true);
  });

  it("daily reminders notify leads and staff once, and the overview shows each viewer their own list", async () => {
    const { runIncubationReminders } = await import("./reminders");
    const first = await runIncubationReminders();
    expect(first.created).toBeGreaterThan(0);
    expect(first.emailed).toBe(0);
    // Team B (lead "target") has never recorded a sale, so yesterday is missing.
    const forLead = await prisma.incubationNotification.findMany({ where: { userId: "target", programId } });
    expect(forLead.some((n) => n.kind === "missing_sales")).toBe(true);
    const digest = await prisma.incubationNotification.findFirst({
      where: { userId: "manager", programId, kind: "digest" },
    });
    expect(digest?.body).toContain("Team B");
    // Only the team's current lead is chased for team sales, never other members.
    const teamAMembers = await prisma.incubationMember.findMany({ where: { teamId: teamA } });
    const nonLeadRolls = teamAMembers.filter((m) => !m.isLead).map((m) => m.roll);
    const nonLeadUsers = await prisma.user.findMany({ where: { studentRoll: { in: nonLeadRolls } } });
    expect(nonLeadUsers.length).toBeGreaterThan(0);
    expect(
      await prisma.incubationNotification.count({
        where: { userId: { in: nonLeadUsers.map((u) => u.id) }, programId, kind: "missing_sales" },
      }),
    ).toBe(0);
    // A second run on the same day creates nothing new.
    expect((await runIncubationReminders()).created).toBe(0);

    const staffView = await api.overview(manager, programId);
    expect(staffView.monitor!.some((i: any) => i.kind === "missing_sales" && i.teamId === teamB)).toBe(true);
    const leadView = await api.overview(target, programId);
    expect(leadView.monitor!.length).toBeGreaterThan(0);
    expect(leadView.monitor!.every((i: any) => i.teamId === teamB)).toBe(true);
    const nonLead = [lead, member].find((a) => nonLeadUsers.some((u) => u.id === a.id))!;
    const memberView = await api.overview(nonLead, programId);
    expect(memberView.monitor!.some((i: any) => i.kind === "missing_sales")).toBe(false);
  });

  it("publishes a frozen revenue ranking, shows it to students and the public link, and can withdraw it", async () => {
    await expect(send(lead, "publish_results", {})).rejects.toThrow(/publish results/);
    await send(manager, "publish_results", { note: "Week 1" });
    const staff = await api.overview(manager, programId);
    const ranking = (staff.results!.snapshot as any).ranking as any[];
    expect(staff.results!.metric).toBe("revenue");
    expect(ranking[0].rank).toBe(1);
    for (let i = 1; i < ranking.length; i++) expect(ranking[i - 1].revenue).toBeGreaterThanOrEqual(ranking[i].revenue);
    // Republishing replaces the previous snapshot instead of keeping two current ones.
    await send(manager, "publish_results", {});
    expect(await prisma.incubationResult.count({ where: { programId, withdrawnAt: null } })).toBe(1);
    expect((await api.overview(target, programId)).results).not.toBeNull();
    await send(manager, "withdraw_results", { note: "Recount" });
    expect((await api.overview(target, programId)).results).toBeNull();
    const actions = (await prisma.incubationAudit.findMany({ where: { programId, action: { startsWith: "results." } } })).map(
      (a) => a.action,
    );
    expect(actions.sort()).toEqual(["results.published", "results.published", "results.withdrawn"]);
  });

  it("sheet_save adds, edits and deletes rows atomically and names the failing row", async () => {
    const before = await prisma.incubationRecord.count({ where: { programId } });
    const today = todayDhaka();
    // One bad row (unknown expense type) rolls back the valid rows too.
    await expect(
      send(manager, "sheet_save", {
        reason: "Paper records",
        creates: [
          { key: "ok-1", kind: "expense", teamId: teamA, date: today, data: { amount: "10", expenseType: "Transport" } },
          { key: "bad-1", kind: "expense", teamId: teamA, date: today, data: { amount: "10", expenseType: "Nope" } },
        ],
      }),
    ).rejects.toThrow(/^\[\[bad-1\]\]/);
    expect(await prisma.incubationRecord.count({ where: { programId } })).toBe(before);
    // Overselling stock fails the final ledger check and saves nothing.
    await expect(
      send(manager, "sheet_save", {
        reason: "Paper records",
        creates: [
          { key: "s1", kind: "sale", teamId: teamA, date: today, data: { lines: [{ productId: product, quantity: "999999", unitPrice: "1" }], areaId: area } },
        ],
      }),
    ).rejects.toThrow();
    expect(await prisma.incubationRecord.count({ where: { programId } })).toBe(before);

    const expense = await prisma.incubationRecord.findFirstOrThrow({
      where: { programId, kind: "expense", status: "posted" },
      orderBy: { createdAt: "asc" },
    });
    const victim = await prisma.incubationRecord.findFirstOrThrow({
      where: { programId, kind: "expense", status: "posted", NOT: { id: expense.id } },
    }).catch(async () =>
      prisma.incubationRecord.create({
        data: {
          courseId: "course-a",
          programId,
          teamId: teamA,
          kind: "expense",
          date: today,
          data: { amount: "1", expenseType: "Transport" },
          requestKey: "sheet-victim",
          requestHash: "x",
          enteredBy: "manager",
          enteredByName: "Manager",
        },
      }),
    );
    const out = await send(manager, "sheet_save", {
      reason: "Paper records",
      creates: [
        { key: "e1", kind: "expense", teamId: teamA, date: today, data: { amount: "25", expenseType: "Transport", note: "Rickshaw" } },
        { key: "f1", kind: "fgd", teamId: teamA, date: today, data: { findings: ["Price matters", "", ""], actions: ["Offer combo", "", ""] } },
      ],
      updates: [{ key: "u1", recordId: expense.id, version: expense.version, date: expense.date, data: { ...(expense.data as object), amount: "77" } }],
      voids: [{ recordId: victim.id, version: victim.version }],
    });
    expect(out).toEqual({ created: 2, updated: 1, voided: 1 });
    expect(((await prisma.incubationRecord.findUniqueOrThrow({ where: { id: expense.id } })).data as any).amount).toBe("77");
    expect((await prisma.incubationRecord.findUniqueOrThrow({ where: { id: victim.id } })).status).toBe("void");
    const actions = (
      await prisma.incubationAudit.findMany({ where: { programId, action: { startsWith: "record.sheet_" } } })
    ).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["record.sheet_created", "record.sheet_corrected", "record.sheet_voided"]));
    // Students cannot use the sheet.
    await expect(send(lead, "sheet_save", { reason: "x x x", voids: [] })).rejects.toThrow();
  });

  it("after the end date only staff can add or change entries; a deleted program disappears", async () => {
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
    const created = (await api.command(manager, {
      action: "program",
      payload: {
        name: "Ended lab",
        description: "",
        startDate: "2026-01-01",
        endDate: yesterday,
        batchNames: ["Batch 1"],
        staffIds: [],
        settings,
        status: "active",
      },
    })) as any;
    const team = (await api.command(manager, {
      action: "team",
      programId: created.id,
      payload: { name: "Ended team", studentIds: ["s-target"], leadId: "s-target", active: true },
    })) as any;
    const expense = (date: string, key: string) => ({
      action: "record",
      programId: created.id,
      payload: { teamId: team.id, kind: "expense", date, requestKey: key, data: { amount: "5", expenseType: "Transport" } },
    });
    // The student (team lead) is shut out once the end date has passed…
    await expect(api.command(target, expense(yesterday, "student-late"))).rejects.toThrow(/closed|running/);
    // …but staff can still record and correct.
    const staffEntry = (await api.command(manager, expense(yesterday, "staff-late"))) as any;
    expect(staffEntry.status).toBe("posted");
    await expect(
      api.command(target, {
        action: "correct",
        programId: created.id,
        payload: { recordId: staffEntry.id, version: 1, date: yesterday, data: { amount: "6", expenseType: "Transport" }, reason: "typo", void: false },
      }),
    ).rejects.toThrow(/closed/);
    expect((await api.overview(manager, created.id)).state).toBe("ended");

    // Deleting needs the exact name and staff rights, then hides the program everywhere.
    await expect(
      api.command(target, { action: "delete_program", programId: created.id, payload: { confirmName: "Ended lab", reason: "duplicate" } }),
    ).rejects.toThrow();
    await expect(
      api.command(manager, { action: "delete_program", programId: created.id, payload: { confirmName: "Ended", reason: "duplicate" } }),
    ).rejects.toThrow(/exactly/);
    await api.command(manager, { action: "delete_program", programId: created.id, payload: { confirmName: " Ended lab ", reason: "Created twice" } });
    expect((await api.overview(manager)).programs.some((p: any) => p.id === created.id)).toBe(false);
    await expect(api.overview(manager, created.id)).rejects.toThrow(/not found/);
    const row = await prisma.incubationProgram.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deleteReason).toBe("Created twice");
    expect(await prisma.incubationRecord.count({ where: { programId: created.id } })).toBe(1);
    expect(await prisma.incubationAudit.count({ where: { programId: created.id, action: "program.deleted" } })).toBe(1);
  });

  it("audit fixes: transfer-only target team, safe date edits, closing checks, link revoke, force check-out, sheet retries", async () => {
    // Only a transfer may name a receiving team: anything else is stored without one,
    // so it can never appear in (and break) the other team's records.
    const stray = await send(manager, "record", {
      teamId: teamA,
      targetTeamId: teamB,
      kind: "expense",
      date: todayDhaka(),
      requestKey: crypto.randomUUID(),
      data: { amount: "5", expenseType: "Transport" },
    });
    expect(stray.targetTeamId).toBeNull();

    const created = (await api.command(manager, {
      action: "program",
      payload: { name: "Audit lab", description: "", startDate: "2026-01-01", endDate: null, batchNames: ["Batch 1"], staffIds: [], settings, status: "active" },
    })) as any;
    const pid2 = created.id;
    const t = (await api.command(manager, {
      action: "team",
      programId: pid2,
      payload: { name: "Audit team", studentIds: ["s-target"], leadId: "s-target", active: true },
    })) as any;
    await api.command(manager, {
      action: "record",
      programId: pid2,
      payload: { teamId: t.id, kind: "expense", date: "2026-01-05", requestKey: crypto.randomUUID(), data: { amount: "5", expenseType: "Transport" } },
    });
    const base = { name: "Audit lab", description: "", endDate: null, batchNames: ["Batch 1"], staffIds: [], settings };
    // Moving the start date past an existing entry is refused.
    await expect(
      api.command(manager, { action: "program", programId: pid2, payload: { ...base, startDate: "2026-02-01", status: "active" } }),
    ).rejects.toThrow(/outside the program/);
    // A late student entry stays pending; closing with it pending needs a reason.
    const late = (await api.command(target, {
      action: "record",
      programId: pid2,
      payload: { teamId: t.id, kind: "expense", date: "2026-01-10", requestKey: crypto.randomUUID(), data: { amount: "3", expenseType: "Transport", reason: "Paper log" } },
    })) as any;
    expect(late.status).toBe("pending");
    await expect(
      api.command(manager, { action: "program", programId: pid2, payload: { ...base, startDate: "2026-01-01", status: "closed" } }),
    ).rejects.toThrow(/still need action/);
    await api.command(manager, {
      action: "program",
      programId: pid2,
      payload: { ...base, startDate: "2026-01-01", status: "closed", reason: "Closing early for the audit test" },
    });
    // A closed program cannot publish a new public link but can always revoke it.
    await expect(api.command(manager, { action: "share", programId: pid2, payload: { enabled: true } })).rejects.toThrow();
    await api.command(manager, { action: "share", programId: pid2, payload: { enabled: false } });

    // Staff can close a session a student forgot to check out.
    const position = { latitude: 23.8, longitude: 90.4, accuracy: 15, capturedAt: new Date().toISOString() };
    const open = (await field.fieldCommand(target, { action: "checkin", programId, position, areaId: area })) as any;
    await expect(
      field.fieldCorrectionCommand(target, { action: "field_force_checkout", programId, payload: { sessionId: open.session.id, reason: "forgot" } }),
    ).rejects.toThrow();
    const closed = (await field.fieldCorrectionCommand(manager, {
      action: "field_force_checkout",
      programId,
      payload: { sessionId: open.session.id, reason: "Forgot to check out" },
    })) as any;
    expect(closed.checkOut).not.toBeNull();

    // A retried sheet save does not add the same new row twice; bad dates name the row.
    const row = { key: "n-retry-1", kind: "expense", teamId: teamA, date: todayDhaka(), data: { amount: "4", expenseType: "Transport" } };
    const before = await prisma.incubationRecord.count({ where: { programId } });
    expect((await send(manager, "sheet_save", { reason: "Retry check", creates: [row] })).created).toBe(1);
    expect((await send(manager, "sheet_save", { reason: "Retry check", creates: [row] })).created).toBe(0);
    expect(await prisma.incubationRecord.count({ where: { programId } })).toBe(before + 1);
    await expect(
      send(manager, "sheet_save", { reason: "Bad date", creates: [{ ...row, key: "n-bad-date", date: "07/11/2026" }] }),
    ).rejects.toThrow(/^\[\[n-bad-date\]\]/);
  });

  it("refuses to send a program with entries back to draft, and cancelling needs a reason", async () => {
    const current = await prisma.incubationProgram.findUniqueOrThrow({ where: { id: programId } });
    expect(current.status).toBe("active");
    const payload = {
      name: current.name,
      description: current.description,
      startDate: current.startDate,
      endDate: current.endDate,
      batchNames: current.batchNames,
      staffIds: current.staffIds,
      settings,
    };
    await expect(
      api.command(manager, {
        action: "program",
        programId,
        payload: { ...payload, status: "draft", reason: "test" },
      }),
    ).rejects.toThrow(/cannot go back to Draft/);
    await expect(
      api.command(manager, { action: "program", programId, payload: { ...payload, status: "cancelled" } }),
    ).rejects.toThrow(/reason/);
  });

  it("audit history cannot be overwritten even by a direct database update", async () => {
    await expect(
      fixture.db.exec("UPDATE incubation_audit SET reason='changed'"),
    ).rejects.toThrow(/immutable/);
  });
  it("database RLS fails closed for an unprivileged role", async () => {
    await fixture.db.exec(
      "DO $$ BEGIN CREATE ROLE incubation_test_role NOSUPERUSER NOBYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$; GRANT USAGE ON SCHEMA public TO incubation_test_role; GRANT SELECT ON ALL TABLES IN SCHEMA public TO incubation_test_role;",
    );
    await fixture.db.exec("SET ROLE incubation_test_role");
    try {
      const rows = await fixture.db.query("SELECT id FROM incubation_programs");
      expect(rows.rows).toHaveLength(0);
    } finally {
      await fixture.db.exec("RESET ROLE");
    }
  });
  it("repeat deploy preserves business records and the Coolify readiness gate succeeds", async () => {
    if (process.env.INCUBATION_NATIVE_TEST !== "1") return;
    const count = await prisma.incubationRecord.count();
    execFileSync(
      process.execPath,
      [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
      { stdio: "pipe", env: { ...process.env, DATABASE_URL: fixture.url } },
    );
    expect(await prisma.incubationRecord.count()).toBe(count);
    execFileSync(process.execPath, ["scripts/ensure-app-role.js"], {
      stdio: "pipe",
      env: {
        ...process.env,
        DATABASE_URL: fixture.url,
        APP_DB_USER: "incubation_runtime_test",
        APP_DB_PASSWORD: "incubation_runtime_local",
      },
    });
    const runtime = new URL(fixture.url);
    runtime.username = "incubation_runtime_test";
    runtime.password = "incubation_runtime_local";
    const output = execFileSync(
      process.execPath,
      ["scripts/incubation-check-schema.cjs"],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: runtime.toString() },
      },
    );
    expect(output).toContain("no data seeded");
  });
});
