/**
 * Catalog helpers shared by the server and the UI.
 *
 * A "product" is a group of catalog rows (kind "product") that share the same
 * category and name. The row with an empty variant is the base product; the
 * other rows are its variants. Once a product has variants, new transactions
 * must pick a variant; the base stays only to keep its old history.
 */
export type CatalogRow = {
  id: string;
  /** Rows without a kind are treated as products. */
  kind?: string;
  name: string;
  variant?: string | null;
  parentId?: string | null;
  unit?: string;
};

export const norm = (s: string | null | undefined) =>
  (s || "").trim().toLocaleLowerCase();

export const groupKey = (p: Pick<CatalogRow, "parentId" | "name">) =>
  `${p.parentId || ""}|${norm(p.name)}`;

export const productLabel = (p?: { name?: string; variant?: string | null } | null) =>
  p ? [p.name, p.variant].filter(Boolean).join(" · ") : "";

export type ProductGroup<T extends CatalogRow = CatalogRow> = {
  key: string;
  categoryId: string;
  name: string;
  base: T | null;
  variants: T[];
  rows: T[];
};

export function groupProducts<T extends CatalogRow>(rows: T[]): ProductGroup<T>[] {
  const groups = new Map<string, ProductGroup<T>>();
  for (const r of rows) {
    if ((r.kind ?? "product") !== "product") continue;
    const key = groupKey(r);
    const g =
      groups.get(key) ||
      groups
        .set(key, {
          key,
          categoryId: r.parentId || "",
          name: r.name,
          base: null,
          variants: [],
          rows: [],
        })
        .get(key)!;
    g.rows.push(r);
    if (r.variant) g.variants.push(r);
    else if (!g.base) {
      g.base = r;
      g.name = r.name;
    }
  }
  for (const g of groups.values())
    g.variants.sort((a, b) => (a.variant || "").localeCompare(b.variant || ""));
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Products that may be picked for a new transaction. A base product that has
 * variants is hidden; ids in `keep` (already used on the line being edited)
 * always stay so an old entry can still be shown and saved. */
export function selectableProducts<T extends CatalogRow>(
  rows: T[],
  keep: Iterable<string> = [],
): T[] {
  const keepSet = new Set(keep);
  const withVariants = new Set(
    rows.filter((r) => (r.kind ?? "product") === "product" && r.variant).map(groupKey),
  );
  return rows.filter(
    (r) =>
      (r.kind ?? "product") === "product" &&
      (keepSet.has(r.id) || r.variant || !withVariants.has(groupKey(r))),
  );
}

/** Replace ids under the given JSON keys anywhere inside a value. */
export function remapIds(
  value: unknown,
  keys: readonly string[],
  map: Record<string, string>,
): { value: unknown; changed: boolean } {
  let changed = false;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (keys.includes(k) && typeof x === "string" && map[x]) {
          out[k] = map[x];
          changed = true;
        } else out[k] = walk(x);
      }
      return out;
    }
    return v;
  };
  const out = walk(value);
  return { value: changed ? out : value, changed };
}

/** Collect every id found under the given JSON keys. */
export function collectIds(value: unknown, keys: readonly string[], into = new Set<string>()) {
  if (Array.isArray(value)) for (const x of value) collectIds(x, keys, into);
  else if (value && typeof value === "object")
    for (const [k, x] of Object.entries(value as Record<string, unknown>)) {
      if (keys.includes(k) && typeof x === "string") into.add(x);
      else collectIds(x, keys, into);
    }
  return into;
}

export const REF_KEYS = {
  product: ["productId"],
  area: ["areaId", "startAreaId", "endAreaId"],
  category: ["categoryId"],
} as const;
