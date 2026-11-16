import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { startIncubationTestDatabase } from "../../../test/incubation-database";
import type { Actor } from "./server";
import { todayDhaka } from "./domain";

let fixture: Awaited<ReturnType<typeof startIncubationTestDatabase>>,
  prisma: (typeof import("@/lib/db"))["prisma"],
  api: typeof import("./server");
let programId = "",
  team = "",
  food = "",
  drinks = "",
  area = "",
  area2 = "";
const manager: Actor = {
  id: "cat-manager",
  email: "cat-manager@test.local",
  displayName: "Manager",
  role: "admin",
  courseId: "course-cat",
};
const lead: Actor = {
  id: "cat-lead",
  email: "cat-lead@test.local",
  displayName: "Lead",
  role: "student",
  courseId: "course-cat",
};
const send = (actor: Actor, action: string, payload: Record<string, unknown>) =>
  api.command(actor, { action, programId, payload }) as Promise<any>;
const record = (actor: Actor, kind: string, data: unknown) =>
  send(actor, "record", {
    teamId: team,
    kind,
    date: todayDhaka(),
    data,
    requestKey: crypto.randomUUID(),
  });
const rows = () =>
  prisma.incubationCatalog.findMany({ where: { programId }, orderBy: [{ name: "asc" }, { variant: "asc" }] });
const bundle = () => api.overview(manager, programId) as Promise<any>;
const stockOf = async (productId: string) =>
  (await bundle()).ledger.stocks[`${team}|${productId}`]?.quantity || 0;

beforeAll(async () => {
  fixture = await startIncubationTestDatabase(51000 + (process.pid % 4000));
  process.env.DATABASE_URL = fixture.url;
  prisma = (await import("@/lib/db")).prisma;
  api = await import("./server");
  await prisma.course.create({
    data: {
      id: "course-cat",
      slug: "incubation-cat",
      name: "Catalog Test",
      settings: { features: { business_incubation: true } },
    },
  });
  await prisma.batch.create({ data: { id: "batch-cat", courseId: "course-cat", name: "Batch C" } });
  await prisma.user.create({
    data: {
      id: lead.id,
      courseId: "course-cat",
      email: lead.email,
      displayName: "lead",
      passwordHash: "unused",
      role: "student",
      studentBatchName: "Batch C",
      studentRoll: "1",
    },
  });
  await prisma.batchStudent.create({
    data: { id: "s-cat-lead", courseId: "course-cat", batchId: "batch-cat", batchName: "Batch C", roll: "1", name: "lead" },
  });
  await prisma.user.create({
    data: {
      id: manager.id,
      courseId: "course-cat",
      email: manager.email,
      displayName: "Manager",
      passwordHash: "unused",
      role: "admin",
    },
  });
  programId = (
    (await api.command(manager, {
      action: "program",
      payload: {
        name: "Catalog Lab",
        description: "",
        startDate: "2026-01-01",
        endDate: null,
        batchNames: ["Batch C"],
        staffIds: [],
        settings: {
          sprintDays: 3,
          enforceCategory: false,
          maxFieldHours: null,
          trackingMinutes: 5,
          retentionDays: 30,
          expenseTypes: ["Transport"],
        },
        status: "active",
      },
    })) as any
  ).id;
  team = (
    await send(manager, "team", { name: "Team C", studentIds: ["s-cat-lead"], leadId: "s-cat-lead", active: true })
  ).id;
  food = (await send(manager, "catalog", { kind: "category", name: "Food", parentId: null })).id;
  drinks = (await send(manager, "catalog", { kind: "category", name: "Drinks", parentId: null })).id;
  area = (await send(manager, "catalog", { kind: "area", name: "North", parentId: null })).id;
  area2 = (await send(manager, "catalog", { kind: "area", name: "South", parentId: null })).id;
  await prisma.incubationAttachment.create({
    data: {
      id: "cat-voucher",
      courseId: "course-cat",
      programId,
      teamId: team,
      uploadedBy: lead.id,
      name: "v.jpg",
      mime: "image/jpeg",
      size: 10,
      path: "incubation/cat.jpg",
    },
  });
  await record(manager, "fund", { amount: "100000" });
}, 60000);

afterAll(async () => {
  await prisma?.$disconnect();
  await fixture?.stop();
});

describe("catalog: products, variants, edit and delete", () => {
  let cake = "",
    small = "",
    big = "",
    tea = "";

  it("creates a product with variants and blocks duplicate names in a category", async () => {
    const out = await send(manager, "catalog_product", {
      name: "Cake",
      parentId: food,
      unit: "piece",
      variants: [{ variant: "Small" }, { variant: "Big", unit: "box" }],
    });
    cake = out.id;
    const all = await rows();
    small = all.find((r) => r.variant === "Small")!.id;
    big = all.find((r) => r.variant === "Big")!.id;
    expect(all.filter((r) => r.name === "Cake").map((r) => [r.variant, r.unit])).toEqual([
      ["", "piece"],
      ["Big", "box"],
      ["Small", "piece"],
    ]);
    expect(all.every((r) => r.active && (r.kind !== "product" || r.fractional))).toBe(true);
    await expect(
      send(manager, "catalog_product", { name: " cake ", parentId: food, unit: "piece" }),
    ).rejects.toThrow(/already exists in this category/);
    await expect(
      send(manager, "catalog", { kind: "product", name: "CAKE", parentId: food, unit: "piece" }),
    ).rejects.toThrow(/already exists/);
    await expect(
      send(manager, "catalog_product", {
        name: "Pie",
        parentId: food,
        unit: "piece",
        variants: [{ variant: "A" }, { variant: "a" }],
      }),
    ).rejects.toThrow(/listed twice/);
    // The same name is fine in a different category.
    await send(manager, "catalog_product", { name: "Cake", parentId: drinks, unit: "cup" });
    tea = (await send(manager, "catalog_product", { name: "Tea", parentId: drinks, unit: "cup" })).id;
    await expect(
      send(manager, "catalog", { kind: "category", name: "food", parentId: null }),
    ).rejects.toThrow(/already exists/);
  });

  it("requires a variant on new entries once a product has variants, and accepts fractions", async () => {
    await expect(
      record(lead, "purchase", {
        lines: [{ productId: cake, quantity: "1", unitPrice: "10" }],
        voucherId: "cat-voucher",
      }),
    ).rejects.toThrow(/select a variant/);
    await record(lead, "purchase", {
      lines: [
        { productId: small, quantity: "10.5", unitPrice: "10" },
        { productId: big, quantity: "4", unitPrice: "50" },
      ],
      voucherId: "cat-voucher",
    });
    await record(lead, "sale", {
      lines: [{ productId: small, quantity: "2", unitPrice: "20" }],
      areaId: area,
    });
    expect(await stockOf(small)).toBe(8500);
    expect(await stockOf(big)).toBe(4000);
    const b = await bundle();
    expect(b.catalogUsage[small]).toBe(2);
    expect(b.catalogUsage[big]).toBe(1);
  });

  it("lets a plain product's existing stock be sold after variants are added, but not bought", async () => {
    const juice = (await send(manager, "catalog_product", { name: "Juice", parentId: drinks, unit: "cup" })).id;
    await record(lead, "purchase", {
      lines: [{ productId: juice, quantity: "3", unitPrice: "10" }],
      voucherId: "cat-voucher",
    });
    await send(manager, "catalog_product", {
      id: juice,
      name: "Juice",
      parentId: drinks,
      unit: "cup",
      variants: [{ variant: "Mango" }],
    });
    await expect(
      record(lead, "purchase", {
        lines: [{ productId: juice, quantity: "1", unitPrice: "10" }],
        voucherId: "cat-voucher",
      }),
    ).rejects.toThrow(/select a variant/);
    await record(lead, "sale", {
      lines: [{ productId: juice, quantity: "2", unitPrice: "15" }],
      areaId: area,
    });
    expect(await stockOf(juice)).toBe(1000);
    await expect(
      record(lead, "sale", { lines: [{ productId: juice, quantity: "5", unitPrice: "15" }], areaId: area }),
    ).rejects.toThrow(/available stock/);
  });

  it("edits everything on a used product: name, category, unit and variant names", async () => {
    await send(manager, "catalog_product", {
      id: cake,
      name: "Cup Cake",
      parentId: food,
      unit: "pcs",
      variants: [
        { id: small, variant: "Mini" },
        { id: big, variant: "Large", unit: "box" },
      ],
    });
    const all = (await rows()).filter((r) => r.parentId === food);
    expect(all.map((r) => [r.name, r.variant, r.unit])).toEqual([
      ["Cup Cake", "", "pcs"],
      ["Cup Cake", "Large", "box"],
      ["Cup Cake", "Mini", "pcs"],
    ]);
    // Stock follows the same ids, so nothing is lost.
    expect(await stockOf(small)).toBe(8500);
    const audit = await prisma.incubationAudit.findFirst({
      where: { programId, action: "catalog.product_saved", entityId: cake },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
  });

  it("refuses to drop a used variant without a target, then moves its entries and costs", async () => {
    await expect(
      send(manager, "catalog_product", {
        id: cake,
        name: "Cup Cake",
        parentId: food,
        unit: "pcs",
        variants: [{ id: small, variant: "Mini" }],
      }),
    ).rejects.toThrow(/Choose the product\/variant to move them to/);
    // A product in another category is not an allowed target.
    await expect(
      send(manager, "catalog_product", {
        id: cake,
        name: "Cup Cake",
        parentId: food,
        unit: "pcs",
        variants: [{ id: small, variant: "Mini" }],
        removed: [{ id: big, targetId: tea }],
      }),
    ).rejects.toThrow(/same category/);
    expect(await stockOf(big)).toBe(4000);
    const before = (await bundle()).ledger.summaries.find((s: any) => s.teamId === team);
    await send(manager, "catalog_product", {
      id: cake,
      name: "Cup Cake",
      parentId: food,
      unit: "pcs",
      variants: [{ id: small, variant: "Mini" }, { variant: "Jumbo" }],
      removed: [{ id: big, targetId: small }],
    });
    expect(await prisma.incubationCatalog.findUnique({ where: { id: big } })).toBeNull();
    expect(await stockOf(small)).toBe(12500);
    const after = (await bundle()).ledger.summaries.find((s: any) => s.teamId === team);
    // All purchase cost of the deleted variant is now counted under the target:
    // the weighted average is recalculated, but nothing is lost or created.
    expect(after.purchases).toBe(before.purchases);
    expect(after.stockValue + after.costOfSales).toBe(before.stockValue + before.costOfSales);
    expect(after.cash).toBe(before.cash);
    expect(after.revenue).toBe(before.revenue);
    const log = await prisma.incubationAudit.findFirst({
      where: { programId, action: "catalog.deleted", entityId: big },
    });
    expect((log?.after as any).movedTo.id).toBe(small);
    expect((log?.after as any).movedRecords).toHaveLength(1);
    expect((await rows()).some((r) => r.variant === "Jumbo")).toBe(true);
  });

  it("deletes unused items directly and used ones only with a replacement", async () => {
    const jumbo = (await rows()).find((r) => r.variant === "Jumbo")!.id;
    await send(manager, "catalog_delete", { id: jumbo });
    expect(await prisma.incubationCatalog.findUnique({ where: { id: jumbo } })).toBeNull();
    await expect(send(manager, "catalog_delete", { id: area })).rejects.toThrow(/Choose the area/);
    await send(manager, "catalog_delete", { id: area, targetId: area2 });
    const sale = await prisma.incubationRecord.findFirst({ where: { programId, kind: "sale" } });
    expect((sale?.data as any).areaId).toBe(area2);
  });

  it("deletes a whole product, moving its history to another product in the category", async () => {
    const bun = (await send(manager, "catalog_product", { name: "Bun", parentId: food, unit: "pcs" })).id;
    await expect(send(manager, "catalog_delete", { id: cake, whole: true })).rejects.toThrow(/Choose/);
    await send(manager, "catalog_delete", { id: cake, whole: true, targetId: bun });
    expect((await rows()).some((r) => r.name === "Cup Cake")).toBe(false);
    expect(await stockOf(bun)).toBe(12500);
  });

  it("deletes a category by moving products and merging same-name ones", async () => {
    const snack = (await send(manager, "catalog", { kind: "category", name: "Snack", parentId: null })).id;
    const tea2 = (await send(manager, "catalog_product", { name: "tea", parentId: snack, unit: "cup" })).id;
    const chips = (await send(manager, "catalog_product", { name: "Chips", parentId: snack, unit: "pack" })).id;
    await record(lead, "purchase", {
      lines: [{ productId: tea2, quantity: "3", unitPrice: "5" }],
      voucherId: "cat-voucher",
    });
    await send(manager, "sprint", { teamId: team, categoryId: snack, startDate: todayDhaka(), endDate: todayDhaka() });
    await expect(send(manager, "catalog_delete", { id: snack })).rejects.toThrow(/Choose the category/);
    await send(manager, "catalog_delete", { id: snack, targetId: drinks });
    expect(await prisma.incubationCatalog.findUnique({ where: { id: snack } })).toBeNull();
    expect(await prisma.incubationCatalog.findUnique({ where: { id: tea2 } })).toBeNull();
    expect((await prisma.incubationCatalog.findUnique({ where: { id: chips } }))?.parentId).toBe(drinks);
    expect(await stockOf(tea)).toBe(3000);
    expect((await prisma.incubationSprint.findFirst({ where: { programId } }))?.categoryId).toBe(drinks);
  });

  it("keeps catalog commands staff-only", async () => {
    await expect(send(lead, "catalog_delete", { id: tea, targetId: tea })).rejects.toThrow(/Staff/);
    await expect(
      send(lead, "catalog_product", { name: "X", parentId: drinks, unit: "pcs" }),
    ).rejects.toThrow(/Staff/);
  });
});
