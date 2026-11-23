import { describe, expect, it } from "vitest";
import { toBangla, translate } from "./errors-bn";
import { calculateLedger, IncubationError } from "./domain";

describe("Bangla error messages", () => {
  it("explains a stock shortfall from a correction with team, product, numbers and a fix", () => {
    const t = toBangla(
      'Approving this correction would break stock: Team "TEAM 01" — Water Bottle · 500ml: more than the available stock on 2026-11-15 (in stock: 4.000, needed: 6.000; entry: Sale).',
    );
    expect(t).toContain("এই সংশোধন অনুমোদন করা যাচ্ছে না");
    expect(t).toContain("“TEAM 01” টিমের");
    expect(t).toContain("“Water Bottle · 500ml”");
    expect(t).toContain("6 টি লাগবে");
    expect(t).toContain("মাত্র 4 টি");
    expect(t).toContain("\nকী করবেন: ");
  });

  it("names the product when pending transfers exceed team stock", () => {
    const t = toBangla(
      'Team "TEAM 2" — USB Cable · 60 Tk: not enough stock for transfers waiting to be accepted (in stock: 8.000, in transfers: 9.000).',
    );
    expect(t).toContain("“TEAM 2” টিমের “USB Cable · 60 Tk”");
    expect(t).toContain("মোট 9 টি");
    expect(t).toContain("মাত্র 8 টি");
    expect(t).toContain("\nকী করবেন: ");
  });

  it("still understands the old stock message format", () => {
    expect(
      translate("Water Bottle: more than the available stock on 2026-11-15 (in stock: 4.000).").problem,
    ).toContain("মাত্র 4 টি");
  });

  it("keeps the data-sheet row prefix and translates the field wrapper", () => {
    const t = toBangla('[[row-7]] "amount": Enter a valid number (up to 2 decimal places).');
    expect(t.startsWith("[[row-7]] ")).toBe(true);
    expect(t).toContain("টাকার পরিমাণ");
  });

  it("translates zod validation output and leaves Bangla untouched", () => {
    expect(toBangla("leadId: String must contain at least 1 character(s)")).toContain("টিম লিডার");
    expect(toBangla("আগে থেকেই বাংলা")).toBe("আগে থেকেই বাংলা");
  });

  it("gives every unknown message a Bangla wrapper with the original text", () => {
    const t = toBangla("Something new happened.");
    expect(t).toContain("Something new happened.");
    expect(t).toContain("কী করবেন:");
  });

  it("names the variant and the entry type when stock runs short", () => {
    const products = [
      { id: "p1", name: "Water Bottle", variant: "500ml", parentId: "c", unit: "pc", fractional: false, active: true },
    ];
    const at = new Date("2026-11-15T00:00:00Z");
    try {
      calculateLedger(
        [
          { id: "s", teamId: "t", kind: "sale", date: "2026-11-15", status: "posted", createdAt: at, data: { lines: [{ productId: "p1", quantity: "2", unitPrice: "10" }] } },
        ],
        products,
      );
      throw new Error("expected a stock error");
    } catch (e) {
      expect(e).toBeInstanceOf(IncubationError);
      const err = e as IncubationError;
      expect(err.message).toContain("Water Bottle · 500ml");
      expect(err.message).toContain("needed: 2.000; entry: Sale");
      expect(err.details).toMatchObject({ code: "stock_short", teamId: "t", productId: "p1" });
    }
  });
});
