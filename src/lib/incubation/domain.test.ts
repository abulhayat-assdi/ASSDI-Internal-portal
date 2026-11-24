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
it("cash reconciliation compares a count with the balance at that count, not later cash movements", () => {
  const rows = [
    entry("fund", { amount: "1000" }),
    entry("cash_count", { amount: "990" }),
    entry("expense", { amount: "100" }),
  ];
  const f = calculateLedger(rows, products).summaries[0];
  expect(f.cash).toBe(90000);
  expect(f.cashAtCount).toBe(100000);
  expect(f.cashDifference).toBe(-1000);
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
    ).toThrow(/available stock/));
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
    ).toThrow(/reason/));
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
  it("uses decimal integer arithmetic and always accepts fractional quantities", () => {
    expect(lineTotal("0.125", "0.20")).toBe(3);
    expect(scaled("999.99")).toBe(99999);
    expect(() => scaled("0.001")).toThrow();
    expect(
      calculateLedger([entry("purchase", { lines: [line("0.5")] })], products)
        .stocks["a|p"]?.quantity,
    ).toBe(500);
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
describe("sprint stock pooling", () => {
  const sprints = [{ teamId: "a", startDate: "2026-11-18", endDate: "2026-11-30" }];
  const late = () => [
    entry("fund", { amount: "1000" }, { date: "2026-11-18" }),
    // Sold on the 20th, but the purchase was entered with the 22nd's date.
    entry("sale", { lines: [line("3", "150")] }, { date: "2026-11-20" }),
    entry("purchase", { lines: [line("5", "100")] }, { date: "2026-11-22" }),
  ];
  it("counts every purchase in the sprint for a sale dated earlier in that sprint", () => {
    expect(() => calculateLedger(late(), products)).toThrow(/more than the available stock/);
    const l = calculateLedger(late(), products, { sprints });
    expect(l.stocks["a|p"].quantity).toBe(2000);
    const s = l.summaries[0];
    expect(s.costOfSales).toBe(30000);
    expect(s.revenue).toBe(45000);
    expect(s.cash).toBe(100000 + 45000 - 50000);
  });
  it("keeps cash on the real date, so a cash count before the purchase is not disturbed", () => {
    const rows = [
      entry("fund", { amount: "1000" }, { date: "2026-11-18" }),
      entry("cash_count", { amount: "1000" }, { date: "2026-11-19" }),
      entry("purchase", { lines: [line("5", "100")] }, { date: "2026-11-22" }),
    ];
    const s = calculateLedger(rows, products, { sprints }).summaries[0];
    expect(s.cashAtCount).toBe(100000);
    expect(s.cashDifference).toBe(0);
  });
  it("does not pool across sprints or into dates before the sprint", () => {
    const rows = [
      entry("sale", { lines: [line("1", "150")] }, { date: "2026-11-17" }),
      entry("purchase", { lines: [line("5", "100")] }, { date: "2026-11-22" }),
    ];
    expect(() => calculateLedger(rows, products, { sprints })).toThrow(/more than the available stock/);
    const other = [
      entry("sale", { lines: [line("1", "150")] }, { date: "2026-11-20", teamId: "b" }),
      entry("purchase", { lines: [line("5", "100")] }, { date: "2026-11-22", teamId: "b" }),
    ];
    expect(() => calculateLedger(other, products, { sprints })).toThrow(/more than the available stock/);
  });
  it("date-filtered reports still work when a sale used stock bought later in the sprint", () => {
    const rows = late();
    const r = buildReport(rows, products, [{ id: "a", name: "A" }], { to: "2026-11-21" }, sprints);
    expect(r.summaries[0].revenue).toBe(45000);
    expect(r.summaries[0].purchases).toBe(0);
    expect(r.summaries[0].cash).toBe(100000 + 45000);
    const after = buildReport(rows, products, [{ id: "a", name: "A" }], { from: "2026-11-21" }, sprints);
    expect(after.summaries[0].revenue).toBe(0);
    expect(after.summaries[0].purchases).toBe(50000);
    expect(after.summaries[0].openingCash).toBe(145000);
    const whole = buildReport(rows, products, [{ id: "a", name: "A" }], {}, sprints);
    expect(whole.summaries[0].netProfit).toBe(15000);
  });
});
describe("sprint pooling for goods received from another team", () => {
  const sprints = [
    { teamId: "a", startDate: "2026-11-14", endDate: "2026-11-30" },
    { teamId: "b", startDate: "2026-11-20", endDate: "2026-11-30" },
  ];
  it("counts a transfer received later in the receiver's sprint, with cash on its own date", () => {
    const rows = [
      entry("purchase", { lines: [line("5")] }, { date: "2026-11-14" }),
      entry("sale", { lines: [line("2", "150")] }, { date: "2026-11-21", teamId: "b" }),
      entry("transfer", { lines: [line("3", "120")] }, { date: "2026-11-22", targetTeamId: "b" }),
    ];
    const l = calculateLedger(rows, products, { sprints });
    expect(l.stocks["b|p"].quantity).toBe(1000);
    const a = l.summaries.find((s) => s.teamId === "a")!,
      b = l.summaries.find((s) => s.teamId === "b")!;
    expect(a.returnGain).toBe(6000);
    expect(a.cash).toBe(-50000 + 36000);
    expect(b.cash).toBe(30000 - 36000);
    expect(b.costOfSales).toBe(24000);
  });
  it("falls back when moving the transfer earlier would leave the sender short", () => {
    const rows = [
      entry("purchase", { lines: [line("3")] }, { date: "2026-11-21" }),
      entry("transfer", { lines: [line("3")] }, { date: "2026-11-22", targetTeamId: "b" }),
    ];
    const l = calculateLedger(rows, products, {
      sprints: [{ teamId: "b", startDate: "2026-11-20", endDate: "2026-11-30" }],
    });
    expect(l.stocks["b|p"].quantity).toBe(3000);
    expect(l.stocks["a|p"].quantity).toBe(0);
  });
});
