import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { scoped, crmClient } from "./db";
import { localDate } from "./domain";
import { mutate, provision, read } from "./service";
import { identity, Identity } from "./access";
import { signJWT, invalidateUserOverrideCache } from "@/lib/auth";
import { starterRequestIds } from "../../../scripts/lib/customer-service-practice.cjs";
import { loadPracticeDataset } from "../../../scripts/lib/customer-service-practice.cjs";
import { loadTrainingCustomers } from "../../../scripts/lib/customer-service-training.cjs";
import { invalidateCourseCache } from "@/lib/course";
const enabled = process.env.CRM_INTEGRATION === "1";
describe.skipIf(!enabled)("CRM isolated PostgreSQL integration", () => {
  const suffix = randomUUID().slice(0, 8),
    courseId = "crm-course-" + suffix,
    slug = "crm-" + suffix,
    batchId = "crm-batch-" + suffix;
  let admin: Identity,
    agent: Identity,
    other: Identity,
    l2: Identity,
    l3: Identity,
    workspace: string,
    otherWorkspace: string,
    team2: string,
    team3: string;
  const options: Record<string, string> = {};
  let complaint: any;
  const request = (userId: string, role = "student") => ({
    id: userId,
    email: userId + "@example.test",
    displayName: userId,
    role,
    courseId,
    studentBatchName: "Training",
    studentRoll: userId,
    permissions: role === "admin" ? ["crm_admin", "crm_supervisor"] : [],
  });
  const body = (
    action: string,
    data?: unknown,
    extra: Record<string, unknown> = {},
  ) => ({
    workspaceId: workspace,
    action,
    data,
    requestId: randomUUID(),
    ...extra,
  });
  const form = () => ({
    callingNumber: "00123 456",
    registeredNumber: "00123456",
    callerType: options.callerType,
    channel: options.channel,
    complaintType: options.complaintType,
    issueType: options.issueType,
    description: "Training transaction",
    tags: [],
    customFields: {},
  });
  beforeAll(async () => {
    for (const key of ["DATABASE_URL", "CUSTOMER_SERVICE_DATABASE_URL"]) {
      const u = new URL(process.env[key]!);
      if (
        u.hostname !== "127.0.0.1" ||
        u.port !== "55439" ||
        !u.pathname.endsWith("_test")
      )
        throw Error("Integration tests require isolated local databases");
    }
    await prisma.course.create({
      data: {
        id: courseId,
        slug,
        name: "CRM integration",
        settings: { features: { crm: true } },
      },
    });
    await prisma.batch.create({
      data: { id: batchId, courseId, name: "Training" },
    });
    for (const [id, role] of [
      ["admin", "admin"],
      ["agent", "student"],
      ["other", "student"],
      ["l2", "student"],
      ["l3", "student"],
    ]) {
      const user = request(id + "-" + suffix, role);
      await prisma.user.create({
        data: {
          ...user,
          role: role as "student" | "admin",
          passwordHash: "test-only",
          permissions: user.permissions,
          activeSession: {
            create: { expiresAt: new Date(Date.now() + 3600000) },
          },
        },
      });
      if (role === "student")
        await prisma.batchStudent.create({
          data: {
            courseId,
            batchId,
            batchName: "Training",
            roll: user.id,
            name: user.displayName,
          },
        });
    }
    const context = (id: string, role = "student"): Identity => ({
      user: request(id + "-" + suffix, role),
      courseId,
      admin: role === "admin",
      staff: role === "admin",
      batchId: role === "student" ? batchId : undefined,
    });
    admin = context("admin", "admin");
    agent = context("agent");
    other = context("other");
    l2 = context("l2");
    l3 = context("l3");
    workspace = (await provision(admin, { batchId })).id;
    const second = await prisma.batch.create({
      data: { courseId, name: "Other batch " + suffix },
    });
    otherWorkspace = (await provision(admin, { batchId: second.id })).id;
    team2 = (
      (await mutate(admin, body("team", { name: "L2", tier: "L2" }))) as any
    ).id;
    team3 = (
      (await mutate(admin, body("team", { name: "L3", tier: "L3" }))) as any
    ).id;
    for (const [ctx, role, teamId] of [
      [agent, "AGENT", null],
      [other, "AGENT", null],
      [l2, "L2", team2],
      [l3, "L3", team3],
    ] as const)
      await mutate(
        admin,
        body("member", { role, teamId, active: true }, { userId: ctx.user.id }),
      );
    for (const kind of [
      "callerType",
      "channel",
      "complaintType",
      "issueType",
      "resolutionReason",
    ])
      options[kind] = (
        (await mutate(
          admin,
          body("option", { kind, label: "Test " + kind }),
        )) as any
      ).id;
    await mutate(
      admin,
      body("policy", { overallMinutes: 60, l2Minutes: 20, l3Minutes: 10 }),
    );
  }, 30000);
  afterAll(async () => {
    await crmClient().$disconnect();
    await prisma.$disconnect();
  });
  it("enforces restricted runtime RLS and transaction-local scope", async () => {
    const roles = await crmClient().$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean }[]
    >`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    expect(roles[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    expect(await crmClient().workspace.count()).toBe(0);
    expect(
      await scoped(courseId, workspace, (tx) => tx.workspace.count()),
    ).toBe(1);
    expect(
      await scoped("wrong-course", workspace, (tx) => tx.workspace.count()),
    ).toBe(0);
    expect(await crmClient().workspace.count()).toBe(0);
  });
  it("creates atomically, replays idempotently and fetches only approved fields", async () => {
    const b = body("create", form());
    complaint = await mutate(agent, b);
    const again = await mutate(agent, b);
    expect((again as any).id).toBe(complaint.id);
    expect(complaint.code).toMatch(/^[A-Z0-9]{10}$/);
    const d = (await read(
      agent,
      workspace,
      "detail",
      new URLSearchParams({ id: complaint.id }),
    )) as any;
    expect(d.interactions).toHaveLength(1);
    expect(d.history).toHaveLength(1);
    const fetched = (await read(
      other,
      workspace,
      "fetch",
      new URLSearchParams({ number: "00123456" }),
    )) as any;
    expect(fetched.source.code).toBe(complaint.code);
    expect(fetched.source.status).toBeUndefined();
    expect(fetched.source.transactionId).toBeUndefined();
    await expect(
      mutate(other, body("edit", form(), { id: complaint.id, version: 1 })),
    ).rejects.toThrow("cannot edit");
  });
  it("blocks cross-batch references and unauthorized detail/search/report access", async () => {
    await expect(
      read(agent, otherWorkspace, "list", new URLSearchParams()),
    ).rejects.toThrow("Workspace access denied");
    await expect(
      read(l2, workspace, "detail", new URLSearchParams({ id: complaint.id })),
    ).rejects.toThrow("not found");
    expect(
      ((await read(l2, workspace, "list", new URLSearchParams())) as any).total,
    ).toBe(0);
    await expect(
      scoped(courseId, workspace, (tx) =>
        tx.note.create({
          data: {
            courseId,
            workspaceId: workspace,
            complaintId: "nonexistent",
            actorId: agent.user.id,
            text: "bad",
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      scoped(courseId, workspace, (tx) =>
        tx.note.create({
          data: {
            courseId,
            workspaceId: otherWorkspace,
            complaintId: complaint.id,
            actorId: agent.user.id,
            text: "bad",
          },
        }),
      ),
    ).rejects.toThrow();
  });
  it("resolves directly, rejects student corrections and preserves final timestamp on staff edit", async () => {
    complaint = await mutate(
      agent,
      body(
        "resolve",
        { resolutionReason: options.resolutionReason },
        { id: complaint.id, version: complaint.version, remark: "Solved" },
      ),
    );
    const final = complaint.resolvedAt;
    await expect(
      mutate(
        agent,
        body("edit", form(), { id: complaint.id, version: complaint.version }),
      ),
    ).rejects.toThrow("cannot edit");
    complaint = await mutate(
      admin,
      body(
        "edit",
        { ...form(), description: "Corrected by supervisor" },
        { id: complaint.id, version: complaint.version },
      ),
    );
    expect(complaint.resolvedAt).toEqual(final);
  });
  it("handles claim races, revert/resubmit continuity, L3 handoff and immutable audit", async () => {
    let c: any = await mutate(agent, body("create", form()));
    c = await mutate(
      agent,
      body("escalate", undefined, {
        id: c.id,
        version: c.version,
        remark: "Need L2",
        teamId: team2,
      }),
    );
    const first = c.firstL2At,
      due = c.l2DueAt;
    const claims = await Promise.allSettled([
      mutate(l2, body("claim", undefined, { id: c.id, version: c.version })),
      mutate(l2, body("claim", undefined, { id: c.id, version: c.version })),
    ]);
    expect(claims.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    c = (
      claims.find(
        (r) => r.status === "fulfilled",
      ) as PromiseFulfilledResult<any>
    ).value;
    c = await mutate(
      l2,
      body("revert", undefined, {
        id: c.id,
        version: c.version,
        remark: "Correct details",
      }),
    );
    c = await mutate(
      agent,
      body(
        "edit",
        { ...form(), description: "Corrected" },
        { id: c.id, version: c.version },
      ),
    );
    c = await mutate(
      agent,
      body("resubmit", undefined, {
        id: c.id,
        version: c.version,
        remark: "Corrected",
        teamId: team2,
      }),
    );
    expect(c.firstL2At).toEqual(first);
    expect(c.l2DueAt).toEqual(due);
    c = await mutate(
      l2,
      body("claim", undefined, { id: c.id, version: c.version }),
    );
    c = await mutate(
      l2,
      body("escalate", undefined, {
        id: c.id,
        version: c.version,
        remark: "Need L3",
        teamId: team3,
      }),
    );
    expect(c.firstL3At).toEqual(c.l2CompletedAt);
    await expect(
      read(l2, workspace, "detail", new URLSearchParams({ id: c.id })),
    ).rejects.toThrow("not found");
    c = await mutate(
      l3,
      body("claim", undefined, { id: c.id, version: c.version }),
    );
    c = await mutate(
      l3,
      body(
        "resolve",
        { resolutionReason: options.resolutionReason },
        { id: c.id, version: c.version, remark: "L3 solved" },
      ),
    );
    expect(c.status).toBe("RESOLVED");
    await expect(
      scoped(courseId, workspace, (tx) =>
        tx.history.deleteMany({ where: { complaintId: c.id } }),
      ),
    ).rejects.toThrow();
    await expect(
      scoped(courseId, workspace, (tx) =>
        tx.complaint.update({
          where: { id: c.id },
          data: { code: "AAAAAAAAAA" },
        }),
      ),
    ).rejects.toThrow();
  });
  it("rolls back failed writes and snapshots policy targets", async () => {
    const before = await scoped(courseId, workspace, (tx) =>
      tx.complaint.count(),
    );
    await expect(
      mutate(agent, body("create", { ...form(), issueType: "unknown" })),
    ).rejects.toThrow();
    expect(
      await scoped(courseId, workspace, (tx) => tx.complaint.count()),
    ).toBe(before);
    await mutate(
      admin,
      body("policy", { overallMinutes: 120, l2Minutes: 40, l3Minutes: 20 }),
    );
    const old = (await read(
      agent,
      workspace,
      "detail",
      new URLSearchParams({ id: complaint.id }),
    )) as any;
    expect(old.complaint.policySnapshot.overallMinutes).toBe(60);
    const fresh: any = await mutate(agent, body("create", form()));
    expect(fresh.policySnapshot.overallMinutes).toBe(120);
  });
  it("enforces inactive memberships and can restore a read-only workspace", async () => {
    await mutate(
      admin,
      body(
        "member",
        { role: "AGENT", active: false },
        { userId: other.user.id },
      ),
    );
    await expect(
      read(other, workspace, "list", new URLSearchParams()),
    ).rejects.toThrow("membership");
    await mutate(admin, body("workspace", { state: "READ_ONLY" }));
    await expect(mutate(agent, body("create", form()))).rejects.toThrow(
      "read-only",
    );
    await mutate(admin, body("workspace", { state: "ACTIVE" }));
  });
  it("rejects queue-filter bypass and scoped option references", async () => {
    let c: any = await mutate(agent, body("create", form()));
    c = await mutate(
      agent,
      body("escalate", undefined, {
        id: c.id,
        version: c.version,
        remark: "Help",
        teamId: team2,
      }),
    );
    c = await mutate(
      l2,
      body("claim", undefined, { id: c.id, version: c.version }),
    );
    c = await mutate(
      l2,
      body("revert", undefined, {
        id: c.id,
        version: c.version,
        remark: "Correct",
      }),
    );
    const result = (await read(
      l2,
      workspace,
      "list",
      new URLSearchParams({ queue: "AGENT", code: c.code }),
    )) as any;
    expect(result.total).toBe(0);
    const foreign: any = await mutate(admin, {
      ...body("option", { kind: "issueType", label: "Other workspace" }),
      workspaceId: otherWorkspace,
    });
    await expect(
      scoped(courseId, workspace, (tx) =>
        tx.complaint.update({
          where: { id: c.id },
          data: { issueType: foreign.id },
        }),
      ),
    ).rejects.toThrow();
  });
  it("keeps historical custom fields editable after archival", async () => {
    const field: any = await mutate(
      admin,
      body("option", {
        kind: "field",
        label: "Historical note",
        settings: { type: "text", required: true },
      }),
    );
    let c: any = await mutate(
      agent,
      body("create", { ...form(), customFields: { [field.id]: "Original" } }),
    );
    await mutate(
      admin,
      body(
        "option",
        {
          kind: "field",
          label: "Historical note",
          active: false,
          settings: { type: "text", required: true },
        },
        { id: field.id },
      ),
    );
    c = await mutate(
      agent,
      body(
        "edit",
        {
          ...form(),
          description: "Historical correction",
          customFields: { [field.id]: "Corrected" },
        },
        { id: c.id, version: c.version },
      ),
    );
    expect(c.customFields[field.id]).toBe("Corrected");
    expect(c.fieldSnapshot[0].version).toBe(1);
  });
  it("computes distinct report cohorts and excludes invalid outcomes", async () => {
    const today = localDate(new Date());
    const q = new URLSearchParams({ from: today, to: today });
    const report = (await read(admin, workspace, "report", q)) as any;
    expect(report.metrics.resolved).toBe(2);
    expect(report.metrics.tethered + report.metrics.untethered).toBe(2);
    expect(report.metrics.interactions).toBe(report.metrics.complaints);
    expect(report.metrics.withinSla).toBe(100);
    expect(report.agents.reduce((n: number, a: any) => n + a.resolved, 0)).toBe(
      2,
    );
    const empty = (await read(
      admin,
      workspace,
      "report",
      new URLSearchParams({ from: "2025-01-01", to: "2025-01-01" }),
    )) as any;
    expect(empty.metrics.average).toBeNull();
    expect(empty.metrics.withinSla).toBeNull();
  });
  it("fails closed with missing CRM configuration without breaking portal queries", async () => {
    const saved = process.env.CUSTOMER_SERVICE_DATABASE_URL;
    delete process.env.CUSTOMER_SERVICE_DATABASE_URL;
    try {
      await expect(
        read(admin, workspace, "list", new URLSearchParams()),
      ).rejects.toThrow("not configured");
      expect(await prisma.course.count({ where: { id: courseId } })).toBe(1);
    } finally {
      process.env.CUSTOMER_SERVICE_DATABASE_URL = saved;
    }
  });
  it("atomically submits a new resolution and rolls back invalid submission", async () => {
    const before = await scoped(courseId, workspace, (tx) =>
      tx.complaint.count(),
    );
    await expect(
      mutate(
        agent,
        body("create", form(), {
          initialAction: "resolve",
          remark: "",
          resolutionReason: options.resolutionReason,
        }),
      ),
    ).rejects.toThrow();
    expect(
      await scoped(courseId, workspace, (tx) => tx.complaint.count()),
    ).toBe(before);
    const c: any = await mutate(
      agent,
      body("create", form(), {
        initialAction: "resolve",
        remark: "Solved at first contact",
        resolutionReason: options.resolutionReason,
      }),
    );
    expect(c.status).toBe("RESOLVED");
    expect(c.firstL2At).toBeNull();
    const detail: any = await read(
      agent,
      workspace,
      "detail",
      new URLSearchParams({ id: c.id }),
    );
    expect(detail.interactions).toHaveLength(1);
    expect(detail.history.map((h: any) => h.action)).toEqual([
      "create",
      "resolve",
    ]);
  });
  it("loads exactly 500 training customers and preserves starter complaints per workspace without changing complaints or settings", async () => {
    const counts = await scoped(courseId, workspace, async (tx) => ({
      customers: await tx.customer.count({
        where: { trainingKey: { not: null } },
      }),
      complaints: await tx.complaint.count(),
      policy: await tx.policy.findUnique({
        where: {
          workspaceId_key: {
            workspaceId: workspace,
            key: JSON.stringify(["", "", ""]),
          },
        },
      }),
    }));
    expect(counts.customers).toBe(500);
    const result: any = await mutate(admin, body("dummy"));
    expect(result).toMatchObject({
      total: 500,
      added: 0,
      complaintsAdded: 0,
      starterComplaints: 250,
    });
    const after = await scoped(courseId, workspace, async (tx) => ({
      complaints: await tx.complaint.count(),
      policy: await tx.policy.findUnique({
        where: {
          workspaceId_key: {
            workspaceId: workspace,
            key: JSON.stringify(["", "", ""]),
          },
        },
      }),
    }));
    expect(after.complaints).toBe(counts.complaints);
    expect(after.policy).toEqual(counts.policy);
    await expect(mutate(agent, body("dummy"))).rejects.toThrow("administrator");
    await mutate(admin, body("workspace", { state: "READ_ONLY" }));
    await expect(mutate(admin, body("dummy"))).rejects.toThrow("read-only");
    await mutate(admin, body("workspace", { state: "ACTIVE" }));
  });
  it("fetches both training contact numbers and keeps the dataset isolated across batches", async () => {
    const calling: any = await read(
      agent,
      workspace,
      "fetch",
      new URLSearchParams({ number: "0001 0000 251", by: "calling" }),
    );
    const registered: any = await read(
      agent,
      workspace,
      "fetch",
      new URLSearchParams({ number: "0002 0000 251", by: "registered" }),
    );
    expect(calling.sourceKind).toBe("training");
    expect(registered.source).toEqual(calling.source);
    expect(registered.matchedCallingNumber).toBe("00010000251");
    expect(registered.source.registeredNumber).toBe("00020000251");
    expect(registered.source).not.toHaveProperty("description");
    const otherBatch: any = await read(
      admin,
      otherWorkspace,
      "fetch",
      new URLSearchParams({ number: "00010000251" }),
    );
    expect(otherBatch.customer.id).not.toBe(calling.customer.id);
    expect(otherBatch.source.issueType).not.toBe(calling.source.issueType);
    await expect(
      read(agent, otherWorkspace, "customers", new URLSearchParams()),
    ).rejects.toThrow("access denied");
    const page: any = await read(
      agent,
      workspace,
      "customers",
      new URLSearchParams({ page: "5" }),
    );
    expect(page.total).toBe(250);
    expect(page.rows).toHaveLength(20);
    const search: any = await read(
      agent,
      workspace,
      "customers",
      new URLSearchParams({ search: "00020000251" }),
    );
    expect(search.rows).toHaveLength(1);
  });
  it("prefers latest authorized complaint history for either number without mutating reference data", async () => {
    const initial: any = await read(
      agent,
      workspace,
      "fetch",
      new URLSearchParams({ number: "00010000251" }),
    );
    const { code, createdAt, ...prefill } = initial.source;
    const created: any = await mutate(
      agent,
      body("create", {
        ...form(),
        ...prefill,
        callingNumber: "00010000251",
        description: "Training from reusable reference",
      }),
    );
    const byCalling: any = await read(
      agent,
      workspace,
      "fetch",
      new URLSearchParams({ number: "00010000251" }),
    );
    const byRegistered: any = await read(
      agent,
      workspace,
      "fetch",
      new URLSearchParams({ number: "00020000251", by: "registered" }),
    );
    expect(byCalling.sourceKind).toBe("complaint");
    expect(byRegistered.source.code).toBe(created.code);
    expect(byCalling.source).toEqual(byRegistered.source);
    expect(byCalling.customer).toEqual(initial.customer);
    const untouched: any = await read(
      admin,
      otherWorkspace,
      "fetch",
      new URLSearchParams({ number: "00020000251", by: "registered" }),
    );
    expect(untouched.sourceKind).toBe("training");
    const hiddenFromL2: any = await read(
      l2,
      workspace,
      "fetch",
      new URLSearchParams({ number: "00020000251", by: "registered" }),
    );
    expect(hiddenFromL2.sourceKind).toBe("training");
    expect(hiddenFromL2.source.code).not.toBe(created.code);
    const miss: any = await read(
      agent,
      workspace,
      "fetch",
      new URLSearchParams({ number: "99999999", by: "registered" }),
    );
    expect(miss.source).toBeNull();
    await expect(
      read(
        agent,
        workspace,
        "fetch",
        new URLSearchParams({ number: "", by: "registered" }),
      ),
    ).rejects.toThrow();
    await expect(
      read(
        agent,
        workspace,
        "fetch",
        new URLSearchParams({ number: "00010000251", by: "invalid" }),
      ),
    ).rejects.toThrow();
  });
  it("preloads 250 complete pending cases and preserves later practice work on repeat loading", async () => {
    const seeded = await scoped(courseId, workspace, async (tx) => {
      const cases = await tx.complaint.findMany({
        where: {
          requestId: {
            in: starterRequestIds({ courseId, workspaceId: workspace }),
          },
        },
        orderBy: { requestId: "asc" },
      });
      return {
        cases,
        histories: await tx.history.count({
          where: { complaintId: { in: cases.map((c) => c.id) } },
        }),
        interactions: await tx.interaction.count({
          where: { complaintId: { in: cases.map((c) => c.id) } },
        }),
      };
    });
    expect(seeded.cases).toHaveLength(250);
    expect(seeded.histories).toBe(250);
    expect(seeded.interactions).toBe(250);
    for (const c of seeded.cases) {
      expect(c).toMatchObject({
        status: "PENDING",
        queue: "AGENT",
        creatorId: admin.user.id,
        ownerId: admin.user.id,
      });
      expect(c.callingNumber).toHaveLength(11);
      expect(c.registeredNumber).toHaveLength(11);
      expect(
        c.callerType &&
          c.channel &&
          c.issueType &&
          c.complaintType &&
          c.description &&
          c.transactionId,
      ).toBeTruthy();
      expect(c.transactionAmount?.toNumber()).toBeGreaterThan(0);
      expect(+c.dueAt).toBeGreaterThan(+c.createdAt);
    }
    let c: any = seeded.cases[0];
    const fetched: any = await read(
      agent,
      workspace,
      "fetch",
      new URLSearchParams({ number: c.registeredNumber, by: "registered" }),
    );
    expect(fetched.source.code).toBe(c.code);
    c = await mutate(
      admin,
      body("assign", undefined, {
        id: c.id,
        version: c.version,
        userId: agent.user.id,
        remark: "Practice assignment",
      }),
    );
    c = await mutate(
      agent,
      body(
        "resolve",
        { resolutionReason: options.resolutionReason },
        { id: c.id, version: c.version, remark: "Practice completed" },
      ),
    );
    expect(c.status).toBe("RESOLVED");
    const repeated: any = await mutate(admin, body("dummy"));
    expect(repeated).toMatchObject({
      total: 500,
      added: 0,
      complaintsAdded: 0,
      starterComplaints: 250,
      referenceCustomers: 250,
    });
    const detail: any = await read(
      admin,
      workspace,
      "detail",
      new URLSearchParams({ id: c.id }),
    );
    expect(detail.complaint).toEqual(c);
    expect(detail.history.map((h: any) => h.action)).toEqual([
      "create",
      "assign",
      "resolve",
    ]);
    const otherCases = await scoped(courseId, otherWorkspace, (tx) =>
      tx.complaint.findMany({
        where: {
          requestId: {
            in: starterRequestIds({ courseId, workspaceId: otherWorkspace }),
          },
        },
      }),
    );
    expect(otherCases).toHaveLength(250);
    expect(
      otherCases.every((x) => x.status === "PENDING" && x.id !== c.id),
    ).toBe(true);
    const directory: any = await read(
      admin,
      workspace,
      "customers",
      new URLSearchParams(),
    );
    expect(directory).toMatchObject({ total: 250, starterComplaints: 250 });
    expect(
      directory.rows.every(
        (x: any) => !seeded.cases.some((c) => c.customerId === x.id),
      ),
    ).toBe(true);
  });
  it("upgrades the original 100-reference dataset without replacing existing customers", async () => {
    const batch = await prisma.batch.create({
      data: { courseId, name: "Legacy upgrade " + suffix },
    });
    const w = await scoped(courseId, "", (tx) =>
      tx.workspace.create({
        data: { courseId, batchId: batch.id, name: batch.name },
      }),
    );
    await scoped(courseId, w.id, (tx) =>
      loadTrainingCustomers(tx, { courseId, workspaceId: w.id }),
    );
    const original = await scoped(courseId, w.id, (tx) =>
      tx.customer.findMany({ orderBy: { trainingKey: "asc" } }),
    );
    const result = await scoped(courseId, w.id, (tx) =>
      loadPracticeDataset(
        tx,
        { courseId, workspaceId: w.id },
        { id: admin.user.id, name: admin.user.displayName },
      ),
    );
    expect(result).toMatchObject({
      added: 400,
      total: 500,
      complaintsAdded: 250,
      starterComplaints: 250,
    });
    const retained = await scoped(courseId, w.id, (tx) =>
      tx.customer.findMany({
        where: { id: { in: original.map((c) => c.id) } },
        orderBy: { trainingKey: "asc" },
      }),
    );
    expect(retained).toEqual(original);
    const repeat = await scoped(courseId, w.id, (tx) =>
      loadPracticeDataset(
        tx,
        { courseId, workspaceId: w.id },
        { id: admin.user.id, name: admin.user.displayName },
      ),
    );
    expect(repeat).toMatchObject({ added: 0, complaintsAdded: 0 });
  });
  it("automatically enrolls eligible batch students as Agents and preserves admin overrides", async () => {
    const user = request("new-agent-" + suffix);
    await prisma.user.create({
      data: {
        ...user,
        role: "student",
        passwordHash: "test-only",
        activeSession: {
          create: { expiresAt: new Date(Date.now() + 3600000) },
        },
      },
    });
    await prisma.batchStudent.create({
      data: {
        courseId,
        batchId,
        batchName: "Training",
        roll: user.id,
        name: user.displayName,
      },
    });
    const token = await signJWT(user);
    const ctx = await identity(
      new NextRequest("http://" + slug + ".localhost/api/crm", {
        headers: { host: slug + ".localhost", cookie: "__session=" + token },
      }),
    );
    const setup: any = await read(
      ctx,
      workspace,
      "setup",
      new URLSearchParams(),
    );
    expect(setup.actor.role).toBe("AGENT");
    await read(ctx, workspace, "setup", new URLSearchParams());
    expect(
      await scoped(courseId, workspace, (tx) =>
        tx.member.count({ where: { userId: user.id } }),
      ),
    ).toBe(1);
    await mutate(
      admin,
      body(
        "member",
        { role: "L2", teamId: team2, active: true },
        { userId: user.id },
      ),
    );
    expect(
      ((await read(ctx, workspace, "setup", new URLSearchParams())) as any)
        .actor.role,
    ).toBe("L2");
    await mutate(
      admin,
      body("member", { role: "AGENT", active: false }, { userId: user.id }),
    );
    await expect(
      read(ctx, workspace, "setup", new URLSearchParams()),
    ).rejects.toThrow("membership");
  });
  it("validates real sessions, course host, feature flag, deactivation and revocation", async () => {
    const token = await signJWT(agent.user);
    const req = () =>
      new NextRequest("http://" + slug + ".localhost/api/crm", {
        headers: { host: slug + ".localhost", cookie: "__session=" + token },
      });
    expect((await identity(req())).user.id).toBe(agent.user.id);
    await expect(
      identity(
        new NextRequest("http://" + slug + ".localhost/api/crm", {
          headers: { host: slug + ".localhost" },
        }),
      ),
    ).rejects.toThrow("Sign in");
    await expect(
      identity(
        new NextRequest("http://wrong.localhost/api/crm", {
          headers: { host: "wrong.localhost", cookie: "__session=" + token },
        }),
      ),
    ).rejects.toThrow("unavailable");
    await prisma.course.update({
      where: { id: courseId },
      data: { settings: { features: { crm: false } } },
    });
    invalidateCourseCache(slug, courseId);
    await expect(identity(req())).rejects.toThrow("unavailable");
    await prisma.course.update({
      where: { id: courseId },
      data: { settings: { features: { crm: true } } },
    });
    invalidateCourseCache(slug, courseId);
    await prisma.user.update({
      where: { id: agent.user.id },
      data: { deletedAt: new Date() },
    });
    invalidateUserOverrideCache(agent.user.id);
    await expect(identity(req())).rejects.toThrow("Sign in");
    await prisma.user.update({
      where: { id: agent.user.id },
      data: { deletedAt: null },
    });
    await prisma.activeSession.delete({ where: { userId: agent.user.id } });
    invalidateUserOverrideCache(agent.user.id);
    await expect(identity(req())).rejects.toThrow("Sign in");
  });
});
