import { describe, expect, it } from "vitest";
import { collectIds, groupProducts, productLabel, remapIds, selectableProducts } from "./catalog";

const rows = [
  { id: "c1", kind: "category", name: "Food" },
  { id: "b", kind: "product", name: "Cake", variant: "", parentId: "c1" },
  { id: "s", kind: "product", name: "cake", variant: "Small", parentId: "c1" },
  { id: "t", kind: "product", name: "Tea", variant: "", parentId: "c1" },
  { id: "x", kind: "product", name: "Cake", variant: "", parentId: "c2" },
];

describe("catalog helpers", () => {
  it("groups rows by category and case-insensitive name", () => {
    const g = groupProducts(rows);
    expect(g.map((x) => [x.name, x.categoryId, x.base?.id, x.variants.map((v) => v.id)])).toEqual([
      ["Cake", "c1", "b", ["s"]],
      ["Cake", "c2", "x", []],
      ["Tea", "c1", "t", []],
    ]);
  });
  it("hides a base product that has variants unless it is already used", () => {
    expect(selectableProducts(rows).map((r) => r.id)).toEqual(["s", "t", "x"]);
    expect(selectableProducts(rows, ["b"]).map((r) => r.id)).toEqual(["b", "s", "t", "x"]);
  });
  it("labels, remaps and collects ids deep inside JSON", () => {
    expect(productLabel(rows[2])).toBe("cake · Small");
    const data = { lines: [{ productId: "s" }, { productId: "t" }], areaId: "a" };
    const out = remapIds(data, ["productId"], { s: "t" });
    expect(out.changed).toBe(true);
    expect(out.value).toEqual({ lines: [{ productId: "t" }, { productId: "t" }], areaId: "a" });
    expect(data.lines[0].productId).toBe("s");
    expect(remapIds(data, ["productId"], { z: "t" }).changed).toBe(false);
    expect([...collectIds(data, ["productId", "areaId"])]).toEqual(["s", "t", "a"]);
  });
});
