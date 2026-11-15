/**
 * Catalog commands: categories, products (with variants) and areas.
 *
 * Everything can be edited or deleted at any time. When a deleted item is used
 * by transactions, the caller picks a replacement and every reference
 * (records, correction requests, field sessions, sprints) is moved to it in
 * the same transaction, the full ledger is re-checked, and the move is audited.
 */
import type { IncubationCatalog, Prisma } from "@prisma/client";
import { z } from "zod";
import { insist } from "./domain";
import { collectIds, norm, REF_KEYS, remapIds, productLabel } from "./catalog";

type Tx = Prisma.TransactionClient;
type Deps = {
  tx: Tx;
  actor: { courseId: string };
  pid: string;
  audit: (
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
    reason?: string,
  ) => Promise<unknown>;
  /** Recalculates the full ledger; throws if the data became inconsistent. */
  recompute: () => Promise<unknown>;
};
type RefKind = keyof typeof REF_KEYS;

export const CATALOG_ACTIONS = ["catalog", "catalog_product", "catalog_delete"];

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const name = z.string().trim().min(1, "Enter a name.").max(200);
const id = z.string().min(1).max(100);
const unit = z.string().trim().max(50).optional();
const unitOr = (u: string | undefined, fallback = "piece") => (u || "").trim() || fallback;

/** Count of records (and sprints / field sessions) using each catalog id. */
export async function catalogUsage(tx: Tx, pid: string) {
  const [records, sprints, sessions] = await Promise.all([
    tx.incubationRecord.findMany({ where: { programId: pid }, select: { data: true } }),
    tx.incubationSprint.findMany({ where: { programId: pid }, select: { categoryId: true } }),
    tx.incubationFieldSession.findMany({
      where: { programId: pid },
      select: { startAreaId: true, endAreaId: true, carried: true },
    }),
  ]);
  const keys = [...REF_KEYS.product, ...REF_KEYS.area, ...REF_KEYS.category];
  const usage: Record<string, number> = {};
  const add = (ids: Iterable<string>) => {
    for (const x of ids) usage[x] = (usage[x] || 0) + 1;
  };
  for (const r of records) add(collectIds(r.data, keys));
  for (const s of sprints) add([s.categoryId]);
  for (const s of sessions)
    add(
      new Set([
        s.startAreaId,
        ...(s.endAreaId ? [s.endAreaId] : []),
        ...collectIds(s.carried, REF_KEYS.product),
      ]),
    );
  return usage;
}

/** Moves every reference from the keys of `map` to its values. With `dry`,
 * only counts. Returns what was (or would be) changed. */
async function reassign(
  tx: Tx,
  pid: string,
  kind: RefKind,
  map: Record<string, string>,
  dry: boolean,
) {
  const keys = REF_KEYS[kind];
  const from = Object.keys(map);
  const out = { records: [] as string[], corrections: 0, fieldSessions: 0, fieldCorrections: 0, sprints: 0 };
  if (!from.length) return { ...out, total: 0 };
  const records = await tx.incubationRecord.findMany({
    where: { programId: pid },
    select: { id: true, data: true },
  });
  for (const r of records) {
    const m = remapIds(r.data, keys, map);
    if (!m.changed) continue;
    out.records.push(r.id);
    if (!dry) await tx.incubationRecord.update({ where: { id: r.id }, data: { data: json(m.value) } });
  }
  const select = { id: true, before: true, proposed: true } as const;
  for (const c of await tx.incubationCorrection.findMany({ where: { programId: pid }, select })) {
    const b = remapIds(c.before, keys, map),
      p = remapIds(c.proposed, keys, map);
    if (!b.changed && !p.changed) continue;
    out.corrections++;
    if (!dry)
      await tx.incubationCorrection.update({
        where: { id: c.id },
        data: { before: json(b.value), proposed: json(p.value) },
      });
  }
  for (const c of await tx.incubationFieldCorrection.findMany({ where: { programId: pid }, select })) {
    const b = remapIds(c.before, keys, map),
      p = remapIds(c.proposed, keys, map);
    if (!b.changed && !p.changed) continue;
    out.fieldCorrections++;
    if (!dry)
      await tx.incubationFieldCorrection.update({
        where: { id: c.id },
        data: { before: json(b.value), proposed: json(p.value) },
      });
  }
  if (kind === "product") {
    const sessions = await tx.incubationFieldSession.findMany({
      where: { programId: pid },
      select: { id: true, carried: true },
    });
    for (const s of sessions) {
      const m = remapIds(s.carried, keys, map);
      if (!m.changed) continue;
      out.fieldSessions++;
      if (!dry)
        await tx.incubationFieldSession.update({ where: { id: s.id }, data: { carried: json(m.value) } });
    }
  }
  if (kind === "area") {
    const sessions = await tx.incubationFieldSession.findMany({
      where: { programId: pid, OR: [{ startAreaId: { in: from } }, { endAreaId: { in: from } }] },
      select: { id: true, startAreaId: true, endAreaId: true },
    });
    out.fieldSessions += sessions.length;
    if (!dry)
      for (const s of sessions)
        await tx.incubationFieldSession.update({
          where: { id: s.id },
          data: {
            startAreaId: map[s.startAreaId] || s.startAreaId,
            endAreaId: s.endAreaId ? map[s.endAreaId] || s.endAreaId : null,
          },
        });
  }
  if (kind === "category") {
    const sprints = await tx.incubationSprint.findMany({
      where: { programId: pid, categoryId: { in: from } },
      select: { id: true, categoryId: true },
    });
    out.sprints = sprints.length;
    if (!dry)
      for (const s of sprints)
        await tx.incubationSprint.update({ where: { id: s.id }, data: { categoryId: map[s.categoryId] } });
  }
  const total =
    out.records.length + out.corrections + out.fieldSessions + out.fieldCorrections + out.sprints;
  return { ...out, total };
}

const findCategory = async (tx: Tx, pid: string, categoryId: string | null | undefined) => {
  const c = categoryId
    ? await tx.incubationCatalog.findFirst({ where: { id: categoryId, programId: pid, kind: "category" } })
    : null;
  insist(c, "Select the product category.");
  return c;
};

const groupRows = (tx: Tx, pid: string, row: Pick<IncubationCatalog, "parentId" | "name">) =>
  tx.incubationCatalog.findMany({
    where: {
      programId: pid,
      kind: "product",
      parentId: row.parentId,
      name: { equals: row.name.trim(), mode: "insensitive" },
    },
    orderBy: { variant: "asc" },
  });

/** No other product in the category may use the same name. */
async function assertUniqueProduct(tx: Tx, pid: string, categoryId: string, productName: string, ownIds: string[]) {
  const clash = await tx.incubationCatalog.findFirst({
    where: {
      programId: pid,
      kind: "product",
      parentId: categoryId,
      name: { equals: productName.trim(), mode: "insensitive" },
      id: { notIn: ownIds.length ? ownIds : ["__none__"] },
    },
  });
  insist(!clash, `A product named "${productName.trim()}" already exists in this category.`, 409);
}

/** Validates that `targetId` is allowed as the new home for `rows`' transactions. */
async function productTarget(
  tx: Tx,
  pid: string,
  categoryId: string | null,
  targetId: string | null | undefined,
  excluded: Set<string>,
) {
  insist(targetId, "This item has transactions. Choose the product/variant to move them to.", 409);
  insist(!excluded.has(targetId), "Choose a different product to move the transactions to.");
  const target = await tx.incubationCatalog.findFirst({
    where: { id: targetId, programId: pid, kind: "product", parentId: categoryId },
  });
  insist(target, "The replacement product must be in the same category.");
  return target;
}

/** Deletes product rows, moving their transactions to `target` when needed. */
async function removeProducts(
  d: Deps,
  rows: IncubationCatalog[],
  targetId: string | null | undefined,
  reason: string,
  alsoExcluded: string[] = [],
) {
  if (!rows.length) return null;
  const ids = rows.map((r) => r.id);
  const used = await reassign(d.tx, d.pid, "product", Object.fromEntries(ids.map((x) => [x, "__dry__"])), true);
  let target: IncubationCatalog | null = null,
    moved = used;
  if (used.total) {
    target = await productTarget(d.tx, d.pid, rows[0].parentId, targetId, new Set([...ids, ...alsoExcluded]));
    moved = await reassign(d.tx, d.pid, "product", Object.fromEntries(ids.map((x) => [x, target!.id])), false);
  }
  await d.tx.incubationCatalog.deleteMany({ where: { id: { in: ids }, programId: d.pid } });
  await d.audit(
    "catalog.deleted",
    rows[0].id,
    rows,
    {
      deleted: rows.map((r) => ({ id: r.id, label: productLabel(r) })),
      movedTo: target ? { id: target.id, label: productLabel(target) } : null,
      movedRecords: moved.records,
      movedCorrections: moved.corrections,
      movedFieldSessions: moved.fieldSessions,
      movedFieldCorrections: moved.fieldCorrections,
    },
    reason,
  );
  return target;
}

const productSchema = z.object({
  id: id.optional(),
  name,
  parentId: id,
  unit,
  variants: z
    .array(z.object({ id: id.optional(), variant: name, unit }))
    .max(200)
    .default([]),
  removed: z
    .array(z.object({ id, targetId: id.nullable().optional() }))
    .max(200)
    .default([]),
});

/** Creates or edits a product together with its full list of variants. */
async function saveProduct(d: Deps, input: unknown) {
  const { tx, pid } = d;
  const v = productSchema.parse(input);
  const category = await findCategory(tx, pid, v.parentId);
  const anchor = v.id
    ? await tx.incubationCatalog.findFirst({ where: { id: v.id, programId: pid, kind: "product" } })
    : null;
  insist(!v.id || anchor, "Product not found.", 404);
  const before = anchor ? await groupRows(tx, pid, anchor) : [];
  const beforeIds = before.map((r) => r.id);
  await assertUniqueProduct(tx, pid, category.id, v.name, beforeIds);
  const seen = new Set<string>();
  for (const x of v.variants) {
    insist(!seen.has(norm(x.variant)), `Variant "${x.variant}" is listed twice.`);
    seen.add(norm(x.variant));
    insist(!x.id || before.some((r) => r.id === x.id && r.variant), "Variant not found.");
  }
  const kept = new Set(v.variants.map((x) => x.id).filter(Boolean) as string[]);
  const removedTargets = new Map(v.removed.map((r) => [r.id, r.targetId]));
  const removedRows = before.filter((r) => r.variant && !kept.has(r.id));
  for (const r of v.removed)
    insist(removedRows.some((x) => x.id === r.id), "A removed variant does not belong to this product.");

  const productUnit = unitOr(v.unit, before.find((r) => !r.variant)?.unit);
  const common = { name: v.name, parentId: category.id, fractional: true, active: true };
  // Rename / move every row of the product together.
  if (beforeIds.length)
    await tx.incubationCatalog.updateMany({
      where: { id: { in: beforeIds }, programId: pid },
      data: { name: v.name, parentId: category.id, fractional: true, active: true },
    });
  const base =
    before.find((r) => !r.variant) ||
    (await tx.incubationCatalog.create({
      data: { ...common, kind: "product", variant: "", unit: productUnit, courseId: d.actor.courseId, programId: pid },
    }));
  await tx.incubationCatalog.update({ where: { id: base.id }, data: { unit: productUnit } });
  for (const x of v.variants) {
    const data = { variant: x.variant, unit: unitOr(x.unit, productUnit) };
    if (x.id) await tx.incubationCatalog.update({ where: { id: x.id }, data });
    else
      await tx.incubationCatalog.create({
        data: { ...common, ...data, kind: "product", courseId: d.actor.courseId, programId: pid },
      });
  }
  // Removed variants: move their transactions (if any) to the chosen item, then delete.
  const removedIds = removedRows.map((r) => r.id);
  for (const r of removedRows)
    await removeProducts(
      d,
      [{ ...r, name: v.name, parentId: category.id }],
      removedTargets.get(r.id),
      "Variant removed from product",
      removedIds,
    );
  const after = await groupRows(tx, pid, { parentId: category.id, name: v.name });
  await d.recompute();
  await d.audit("catalog.product_saved", base.id, before, after);
  return { id: base.id, rows: after };
}

const deleteSchema = z.object({
  id,
  /** For a product: delete the whole product with all its variants. */
  whole: z.boolean().default(false),
  targetId: id.nullable().optional(),
});

async function deleteItem(d: Deps, input: unknown) {
  const { tx, pid } = d;
  const v = deleteSchema.parse(input);
  const row = await tx.incubationCatalog.findFirst({ where: { id: v.id, programId: pid } });
  insist(row, "Item not found.", 404);

  if (row.kind === "product") {
    const rows = v.whole || !row.variant ? await groupRows(tx, pid, row) : [row];
    const target = await removeProducts(d, rows, v.targetId, v.whole ? "Product deleted" : "Variant deleted");
    await d.recompute();
    return { deleted: rows.map((r) => r.id), movedTo: target?.id || null };
  }

  if (row.kind === "area") {
    const used = await reassign(tx, pid, "area", { [row.id]: "__dry__" }, true);
    let target: IncubationCatalog | null = null,
      moved = used;
    if (used.total) {
      insist(v.targetId, "This area is used by entries. Choose the area to move them to.", 409);
      insist(v.targetId !== row.id, "Choose a different area.");
      target = await tx.incubationCatalog.findFirst({ where: { id: v.targetId, programId: pid, kind: "area" } });
      insist(target, "Replacement area not found.");
      moved = await reassign(tx, pid, "area", { [row.id]: target.id }, false);
    }
    await tx.incubationCatalog.delete({ where: { id: row.id } });
    await d.recompute();
    await d.audit("catalog.deleted", row.id, row, {
      movedTo: target ? { id: target.id, label: target.name } : null,
      movedRecords: moved.records,
      movedFieldSessions: moved.fieldSessions,
      movedCorrections: moved.corrections + moved.fieldCorrections,
    });
    return { deleted: [row.id], movedTo: target?.id || null };
  }

  // Category: products, sprints and entries move to another category.
  const products = await tx.incubationCatalog.findMany({
    where: { programId: pid, kind: "product", parentId: row.id },
  });
  const used = await reassign(tx, pid, "category", { [row.id]: "__dry__" }, true);
  let target: IncubationCatalog | null = null;
  const merged: { from: string; into: string; label: string }[] = [],
    movedProducts: string[] = [];
  let moved = used;
  if (products.length || used.total) {
    insist(v.targetId, "This category has products or entries. Choose the category to move them to.", 409);
    insist(v.targetId !== row.id, "Choose a different category.");
    target = await tx.incubationCatalog.findFirst({ where: { id: v.targetId, programId: pid, kind: "category" } });
    insist(target, "Replacement category not found.");
    const existing = await tx.incubationCatalog.findMany({
      where: { programId: pid, kind: "product", parentId: target.id },
    });
    const productMap: Record<string, string> = {};
    for (const p of products) {
      const sameGroup = existing.filter((e) => norm(e.name) === norm(p.name));
      const twin = sameGroup.find((e) => norm(e.variant) === norm(p.variant));
      if (twin) {
        // Same product (and variant) already exists there: merge into it.
        productMap[p.id] = twin.id;
        merged.push({ from: p.id, into: twin.id, label: productLabel(twin) });
      } else {
        await tx.incubationCatalog.update({
          where: { id: p.id },
          data: { parentId: target.id, name: sameGroup[0]?.name ?? p.name },
        });
        movedProducts.push(p.id);
      }
    }
    if (Object.keys(productMap).length) {
      await reassign(tx, pid, "product", productMap, false);
      await tx.incubationCatalog.deleteMany({ where: { id: { in: Object.keys(productMap) } } });
    }
    moved = await reassign(tx, pid, "category", { [row.id]: target.id }, false);
  }
  await tx.incubationCatalog.delete({ where: { id: row.id } });
  await d.recompute();
  await d.audit("catalog.deleted", row.id, { category: row, products }, {
    movedTo: target ? { id: target.id, label: target.name } : null,
    movedProducts,
    mergedProducts: merged,
    movedSprints: moved.sprints,
    movedRecords: moved.records,
  });
  return { deleted: [row.id], movedTo: target?.id || null };
}

const itemSchema = z.object({
  id: id.optional(),
  kind: z.enum(["category", "product", "area"]),
  name,
  parentId: id.nullable().optional(),
  variant: z.string().trim().max(200).default(""),
  unit,
});

/** Single-row save: categories, areas, and (for older callers) one product row. */
async function saveItem(d: Deps, input: unknown) {
  const { tx, pid } = d;
  const v = itemSchema.parse(input);
  if (v.kind === "product") {
    const before = v.id
      ? await tx.incubationCatalog.findFirst({ where: { id: v.id, programId: pid, kind: "product" } })
      : null;
    insist(!v.id || before, "Catalog item not found.", 404);
    if (!v.variant && (!before || !before.variant)) {
      // A base product: same as saving the product with its current variants.
      const variants = before
        ? (await groupRows(tx, pid, before))
            .filter((r) => r.variant)
            .map((r) => ({ id: r.id, variant: r.variant, unit: r.unit }))
        : [];
      const out = await saveProduct(d, { id: v.id, name: v.name, parentId: v.parentId, unit: v.unit, variants });
      return out.rows.find((r) => r.id === out.id);
    }
    // A single variant row inside an existing product.
    insist(v.variant, "Enter the variant name.");
    const category = await findCategory(tx, pid, before?.parentId ?? v.parentId);
    const group = await groupRows(tx, pid, { parentId: category.id, name: before?.name ?? v.name });
    insist(group.length, "Create the product first, then add variants to it.");
    insist(
      !group.some((r) => r.id !== v.id && norm(r.variant) === norm(v.variant)),
      `Variant "${v.variant}" already exists for this product.`,
      409,
    );
    const baseUnit = group.find((r) => !r.variant)?.unit;
    const data = { variant: v.variant, unit: unitOr(v.unit, baseUnit), fractional: true, active: true };
    const item = before
      ? await tx.incubationCatalog.update({ where: { id: before.id }, data })
      : await tx.incubationCatalog.create({
          data: {
            ...data,
            kind: "product",
            name: group[0].name,
            parentId: category.id,
            courseId: d.actor.courseId,
            programId: pid,
          },
        });
    await d.audit("catalog.saved", item.id, before, item);
    return item;
  }
  const before = v.id
    ? await tx.incubationCatalog.findFirst({ where: { id: v.id, programId: pid } })
    : null;
  insist(!v.id || (before && before.kind === v.kind), "Catalog item not found.", 404);
  const clash = await tx.incubationCatalog.findFirst({
    where: {
      programId: pid,
      kind: v.kind,
      name: { equals: v.name, mode: "insensitive" },
      id: { not: v.id || "__new__" },
    },
  });
  insist(!clash, `"${v.name}" already exists.`, 409);
  const data = { name: v.name, parentId: null, variant: "", unit: "piece", fractional: true, active: true };
  const item = before
    ? await tx.incubationCatalog.update({ where: { id: before.id }, data: { name: v.name, active: true } })
    : await tx.incubationCatalog.create({
        data: { ...data, kind: v.kind, courseId: d.actor.courseId, programId: pid },
      });
  await d.audit("catalog.saved", item.id, before, item);
  return item;
}

export async function catalogCommand(d: Deps, action: string, payload: unknown) {
  if (action === "catalog_product") return saveProduct(d, payload);
  if (action === "catalog_delete") return deleteItem(d, payload);
  return saveItem(d, payload);
}
