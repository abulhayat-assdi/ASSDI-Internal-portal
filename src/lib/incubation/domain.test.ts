import { describe, it, expect } from "vitest";
import {
  calculateLedger,
  scaled,
  lineTotal,
  isLate,
  validDate,
  type Entry,
  type Product,
} from "./domain";
import { buildReport } from "./report";
const products: Product[] = [
  {
    id: "p",
    name: "Product",
    parentId: "c",
    unit: "piece",
    fractional: false,
    active: true,
  },
];
let seq = 0;
const entry = (
  kind: string,
  data: Entry["data"],
  extra: Partial<Entry> = {},
): Entry => ({
  id: `r${++seq}`,
  teamId: "a",
  kind,
  date: "2026-11-01",
  status: "posted",
  data,
  createdAt: new Date(1793500000000 + seq * 1000),
  ...extra,
});
const line = (quantity: string, unitPrice = "100", cash?: string) => ({
  productId: "p",
  quantity,
  unitPrice,
  ...(cash === undefined ? {} : { cash }),
});
const sample = () => [
  entry("fund", { amount: "5000" }),
  entry("purchase", { lines: [line("10")] }),
  entry("sale", { lines: [line("6", "150")] }),
  entry("expense", { amount: "100" }),
];
describe("incubation accounting", () => {
  it("uses database submission order when timestamps and IDs would sort differently", () => {
    const at = new Date("2026-11-01T10:00:00Z");
    const purchase = entry(
      "purchase",
      { lines: [line("2")] },
      { id: "z-purchase", createdAt: at, entryOrder: 1 },
    );
    const sale = entry(
      "sale",
      { lines: [line("1", "150")] },
      { id: "a-sale", createdAt: at, entryOrder: 2 },
    );
    expect(
      calculateLedger([sale, purchase], products).stocks["a|p"].quantity,
    ).toBe(1000);
  });
  it("limits batch reports to that batch's teams and inventory", () => {
    const rows = [
      entry("purchase", { lines: [line("2")] }),
      entry("transfer", { lines: [line("1")] }, { targetTeamId: "b" }),
    ];
    const report = buildReport(
      rows,
      products,
      [
        { id: "a", name: "A", batchName: "Batch A" },
        { id: "b", name: "B", batchName: "Batch B" },
      ],
      { batchName: "Batch B" },
    );
    expect(report.summaries.map((s) => s.teamId)).toEqual(["b"]);
    expect(report.inventory.map((s) => s.teamId)).toEqual(["b"]);
  });
  it("keeps cash, stock and operating profit separate", () => {
    const l = calculateLedger(sample(), products);
    expect(l.stocks["a|p"]).toMatchObject({ quantity: 4000, value: 40000 });
    expect(l.summaries[0]).toMatchObject({
      cash: 480000,
      revenue: 90000,
      grossProfit: 30000,
      netProfit: 20000,
      principalOutstanding: 500000,
    });
  });
  it("rejects repeated product lines collectively exceeding stock", () =>
    expect(() =>
      calculateLedger(
        [
          entry("purchase", { lines: [line("4")] }),
          entry("sale", { lines: [line("3"), line("3")] }),
        ],
        products,
      ),
    ).toThrow(/স্টকের/));
  it("rejects a historical negative stock even if today's balance is positive", () =>
    expect(() =>
      calculateLedger(
        [
          entry("purchase", { lines: [line("10")] }, { date: "2026-11-03" }),
          entry("sale", { lines: [line("2")] }, { date: "2026-11-01" }),
        ],
        products,
      ),
    ).toThrow());
  it("accounts for supplier return without treating capital as income", () => {
    const s = calculateLedger(
      [...sample(), entry("supplier_return", { lines: [line("2")] })],
      products,
    );
    expect(s.summaries[0]).toMatchObject({
      cash: 500000,
      netProfit: 20000,
      stockValue: 20000,
    });
  });
  it("posts a linked transfer to both teams exactly once", () => {
    const l = calculateLedger(
      [
        ...sample(),
        entry("transfer", { lines: [line("2")] }, { targetTeamId: "b" }),
      ],
      products,
    );
    expect(l.stocks["b|p"]).toMatchObject({ quantity: 2000, value: 20000 });
    expect(l.summaries.find((s) => s.teamId === "b")?.cash).toBe(-20000);
    expect(l.summaries[0].netProfit).toBe(20000);
  });
  it("restores saleable customer returns and reverses profit", () => {
    const rows = sample();
    const sale = rows.find((r) => r.kind === "sale")!;
    const l = calculateLedger(
      [
        ...rows,
        entry("customer_refund", {
          sourceId: sale.id,
          lines: [line("1", "150")],
          saleable: true,
        }),
      ],
      products,
    );
    expect(l.summaries[0]).toMatchObject({
      cash: 465000,
      revenue: 75000,
      netProfit: 15000,
      stockValue: 50000,
    });
  });
  it("rejects returns exceeding the original sale", () => {
    const rows = sample();
    expect(() =>
      calculateLedger(
        [
          ...rows,
          entry("customer_refund", {
            sourceId: rows[2].id,
            lines: [line("7", "150")],
          }),
        ],
        products,
      ),
    ).toThrow();
  });
  it("preserves explained cash variance without inventing a debt collection", () => {
    const rows = sample();
    rows[2].data = {
      lines: [line("6", "150", "700")],
      reason: "Customer short-paid",
    };
    expect(calculateLedger(rows, products).summaries[0]).toMatchObject({
      cash: 460000,
      variance: 20000,
      netProfit: 20000,
    });
  });
  it("rejects unexplained cash difference", () =>
    expect(() =>
      calculateLedger(
        [
          entry("purchase", { lines: [line("2")] }),
          entry("sale", { lines: [line("1", "150", "100")] }),
        ],
        products,
      ),
    ).toThrow(/কারণ/));
  it("principal repayment does not reduce profit", () => {
    const l = calculateLedger(
      [
        ...sample(),
        entry("sale", { lines: [line("4", "150")] }),
        entry("repayment", { amount: "5000" }),
      ],
      products,
    );
    expect(l.summaries[0]).toMatchObject({
      cash: 40000,
      netProfit: 40000,
      principalOutstanding: 0,
    });
  });
  it("does not post pending or rejected records", () =>
    expect(
      calculateLedger(
        [entry("purchase", { lines: [line("5")] }, { status: "pending" })],
        products,
      ).summaries,
    ).toEqual([]));
  it("uses decimal integer arithmetic and rejects fractional pieces", () => {
    expect(lineTotal("0.125", "0.20")).toBe(3);
    expect(scaled("999.99")).toBe(99999);
    expect(() => scaled("0.001")).toThrow();
    expect(() =>
      calculateLedger([entry("purchase", { lines: [line("0.5")] })], products),
    ).toThrow();
  });
  it("uses the precise today/yesterday late-entry boundary", () => {
    expect(isLate("2026-11-04", "2026-11-05")).toBe(false);
    expect(isLate("2026-11-04", "2026-11-06")).toBe(true);
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-99-99")).toBe(false);
  });
  it("date-filtered reports preserve opening balances", () => {
    const rows = sample();
    rows[0].date = rows[1].date = "2026-10-31";
    const r = buildReport(rows, products, [{ id: "a", name: "A" }], {
      from: "2026-11-01",
      to: "2026-11-01",
    });
    expect(r.summaries[0]).toMatchObject({
      openingCash: 400000,
      cash: 480000,
      revenue: 90000,
      purchases: 0,
      netProfit: 20000,
    });
  });
  it("daily net sales include refunds on their actual business date", () => {
    const rows = sample();
    rows.push(
      entry(
        "customer_refund",
        { sourceId: rows[2].id, lines: [line("1", "150")] },
        { date: "2026-11-02" },
      ),
    );
    const r = buildReport(rows, products, [{ id: "a", name: "A" }]);
    expect(r.trend).toEqual([
      { date: "2026-11-01", revenue: 900 },
      { date: "2026-11-02", revenue: -150 },
    ]);
    expect(r.trend.reduce((sum, day) => sum + day.revenue, 0) * 100).toBe(
      r.totals.revenue,
    );
  });
  it("eliminates unrealized internal markup from institution totals", () => {
    const rows = [
      entry("purchase", { lines: [line("2", "100")] }),
      entry("transfer", { lines: [line("2", "150")] }, { targetTeamId: "b" }),
    ];
    const r = buildReport(rows, products, [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
    expect(r.summaries[0].netProfit).toBe(10000);
    expect(r.totals.netProfit).toBe(0);
    expect(r.totals.stockValue).toBe(20000);
  });
  it("reconciles all partial-refund cost rounding to the original cost", () => {
    const rows = [
      entry("purchase", { lines: [line("3", "0.01")] }),
      entry("sale", { lines: [line("3", "0.02")] }),
    ];
    for (let i = 0; i < 3; i++)
      rows.push(
        entry("customer_refund", {
          sourceId: rows[1].id,
          lines: [line("1", "0.02")],
        }),
      );
    const r = calculateLedger(rows, products);
    expect(r.summaries[0].costOfSales).toBe(0);
    expect(r.stocks["a|p"].value).toBe(3);
  });
  it("area performance uses actual sales cost while retaining team balances", () => {
    const rows = sample();
    rows[2].data.areaId = "area-one";
    const r = buildReport(rows, products, [{ id: "a", name: "A" }], {
      areaId: "area-one",
    });
    expect(r.summaries[0]).toMatchObject({
      revenue: 90000,
      costOfSales: 60000,
      netProfit: 30000,
      cash: 480000,
    });
  });
});
