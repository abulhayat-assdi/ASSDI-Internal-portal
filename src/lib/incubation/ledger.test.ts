import { describe, expect, it } from "vitest";
import {
  calculateLedger,
  explainStockError,
  IncubationError,
  type Entry,
  type Product,
  type StockWindow,
} from "./domain";
import { buildReport } from "./report";
import { toBangla } from "./errors-bn";
import { errorDetails, failure } from "./http";
import { sheetSave, type SheetDeps } from "./sheet";

const products: Product[] = [
  { id: "p", name: "Earphone", variant: "Packet", parentId: "c", unit: "pc", fractional: false, active: true },
  { id: "q", name: "Cable", parentId: "c2", unit: "pc", fractional: true, active: true },
];
let n = 0;
const e = (kind: string, data: Entry["data"], o: Partial<Entry> = {}): Entry => ({
  id: `r${++n}`,
  entryOrder: n,
  teamId: "a",
  kind,
  date: "2026-11-20",
  status: "posted",
  data,
  createdAt: new Date(2026, 0, 1, 0, 0, n),
  ...o,
});
const L = (quantity: string, unitPrice = "100", productId = "p") => ({ productId, quantity, unitPrice });
const catchErr = (fn: () => unknown) => {
  try {
    fn();
  } catch (x) {
    return x as IncubationError;
  }
  throw new Error("expected an error");
};

describe("stock-ins count before outflows on the same date (bug 1)", () => {
  const sprints: StockWindow[] = [{ teamId: "a", startDate: "2026-11-18", endDate: "2026-11-30" }];
  it("a day-1 sale entered before the day-1 purchase is fine", () => {
    const rows = [
      e("sale", { lines: [L("2", "150")] }, { date: "2026-11-18" }),
      e("purchase", { lines: [L("5")] }, { date: "2026-11-18" }),
    ];
    expect(calculateLedger(rows, products, { sprints }).stocks["a|p"].quantity).toBe(3000);
    // Same rule outside any sprint: entry order inside one date never matters.
    expect(calculateLedger(rows, products).stocks["a|p"].quantity).toBe(3000);
  });
  it("a sale on the sprint's first day can use a purchase dated later in the sprint", () => {
    const rows = [
      e("purchase", { lines: [L("1")] }, { date: "2026-11-18" }),
      e("sale", { lines: [L("2", "150")] }, { date: "2026-11-18" }),
      e("purchase", { lines: [L("5")] }, { date: "2026-11-20" }),
    ];
    expect(calculateLedger(rows, products, { sprints }).stocks["a|p"].quantity).toBe(4000);
  });
  it("keeps cash on the entry's own position, so a same-day cash count is not disturbed", () => {
    const rows = [
      e("fund", { amount: "1000" }, { date: "2026-11-18" }),
      e("cash_count", { amount: "1000" }, { date: "2026-11-18" }),
      e("purchase", { lines: [L("5")] }, { date: "2026-11-18" }),
    ];
    const s = calculateLedger(rows, products, { sprints }).summaries[0];
    expect(s.cashAtCount).toBe(100000);
    expect(s.cash).toBe(50000);
  });
  it("a transfer is credited at the receiver's sprint start after the sender's day-1 purchase", () => {
    const sp: StockWindow[] = [
      { teamId: "c", startDate: "2026-11-18", endDate: "2026-11-30" },
      { teamId: "d", startDate: "2026-11-18", endDate: "2026-11-30" },
    ];
    const rows = [
      e("purchase", { lines: [L("5")] }, { teamId: "c", date: "2026-11-18" }),
      e("sale", { lines: [L("2", "150")] }, { teamId: "d", date: "2026-11-19" }),
      e("transfer", { lines: [L("3", "120")] }, { teamId: "c", targetTeamId: "d", date: "2026-11-21" }),
    ];
    const l = calculateLedger(rows, products, { sprints: sp });
    expect(l.stocks["c|p"].quantity).toBe(2000);
    expect(l.stocks["d|p"].quantity).toBe(1000);
    const c = l.summaries.find((s) => s.teamId === "c")!,
      d = l.summaries.find((s) => s.teamId === "d")!;
    expect(c.returnGain).toBe(6000);
    expect(d.costOfSales).toBe(24000);
    // 2 of the 3 transferred units were already sold: only 1/3 of the markup is unrealised.
    expect(l.stocks["d|p"].internalMargin).toBe(2000);
  });
  it("a same-day transfer in counts before the receiver's sale entered earlier that day", () => {
    const rows = [
      e("purchase", { lines: [L("5")] }, { teamId: "c", date: "2026-11-10" }),
      e("sale", { lines: [L("2", "150")] }, { teamId: "d", date: "2026-11-12" }),
      e("transfer", { lines: [L("3", "120")] }, { teamId: "c", targetTeamId: "d", date: "2026-11-12" }),
    ];
    expect(calculateLedger(rows, products).stocks["d|p"].quantity).toBe(1000);
  });
  it("a saleable customer return counts before a same-day outflow entered earlier", () => {
    const sale = e("sale", { lines: [L("5", "150")] }, { date: "2026-11-10" });
    const rows = [
      e("purchase", { lines: [L("5")] }, { date: "2026-11-09" }),
      sale,
      e("damage", { lines: [L("2")] }, { date: "2026-11-11" }),
      e("customer_refund", { sourceId: sale.id, lines: [L("2", "150")] }, { date: "2026-11-11" }),
    ];
    const l = calculateLedger(rows, products);
    expect(l.stocks["a|p"]).toMatchObject({ quantity: 0, damaged: 2000 });
    expect(l.summaries[0]).toMatchObject({ revenue: 45000, refunds: 30000, cash: -50000 + 75000 - 30000 });
    // The refund's money effect is still recorded once in full.
    expect(l.effects[rows[3].id].a).toMatchObject({ revenue: -30000, cash: -30000, costOfSales: -20000 });
  });
});

describe("transfers are pooled per transfer, never switched off program-wide (bug 2)", () => {
  const sprints: StockWindow[] = [
    { teamId: "a", startDate: "2026-11-20", endDate: "2026-11-30" },
    { teamId: "b", startDate: "2026-11-18", endDate: "2026-11-30" },
    { teamId: "c", startDate: "2026-11-18", endDate: "2026-11-30" },
    { teamId: "d", startDate: "2026-11-18", endDate: "2026-11-30" },
  ];
  const base = () => [
    e("purchase", { lines: [L("5")] }, { teamId: "c", date: "2026-11-19" }),
    e("sale", { lines: [L("2", "150")] }, { teamId: "d", date: "2026-11-19" }),
    e("transfer", { lines: [L("3", "120")] }, { teamId: "c", targetTeamId: "d", date: "2026-11-21" }),
  ];
  const ab = () => [
    e("purchase", { lines: [L("3")] }, { teamId: "a", date: "2026-11-21" }),
    e("transfer", { lines: [L("3", "120")] }, { teamId: "a", targetTeamId: "b", date: "2026-11-22" }),
  ];
  it("an unrelated team's transfer does not break another team's pooled sale", () => {
    expect(() => calculateLedger(base(), products, { sprints })).not.toThrow();
    expect(() => calculateLedger(ab(), products, { sprints })).not.toThrow();
    const l = calculateLedger([...base(), ...ab()], products, { sprints });
    expect(l.stocks["d|p"].quantity).toBe(1000);
    expect(l.stocks["b|p"].quantity).toBe(3000);
    expect(l.stocks["a|p"].quantity).toBe(0);
  });
  it("the sender is debited on the real date, so its own sales before then still work", () => {
    const rows = [
      e("purchase", { lines: [L("5")] }, { teamId: "c", date: "2026-11-18" }),
      e("sale", { lines: [L("2", "150")] }, { teamId: "c", date: "2026-11-19" }),
      e("transfer", { lines: [L("3", "120")] }, { teamId: "c", targetTeamId: "d", date: "2026-11-25" }),
    ];
    const l = calculateLedger(rows, products, { sprints });
    expect(l.stocks["c|p"].quantity).toBe(0);
    expect(l.stocks["d|p"].quantity).toBe(3000);
  });
  it("names the transfer itself when the sender transfers more than it holds", () => {
    const rows = [
      e("purchase", { lines: [L("2")] }, { teamId: "c", date: "2026-11-18" }),
      e("transfer", { lines: [L("3", "120")] }, { teamId: "c", targetTeamId: "d", date: "2026-11-21" }),
    ];
    const err = catchErr(() => calculateLedger(rows, products, { sprints }));
    expect(err.message).toContain("entry: Transfer to team");
    expect(err.details).toMatchObject({ code: "stock_short", teamId: "c", recordId: rows[1].id, kind: "transfer", date: "2026-11-21", lineIndex: 0 });
  });
  it("names the receiver's sale when the goods arrive too late", () => {
    const rows = [
      e("purchase", { lines: [L("5")] }, { teamId: "a", date: "2026-11-21" }),
      e("sale", { lines: [L("2", "150")] }, { teamId: "b", date: "2026-11-19" }),
      e("transfer", { lines: [L("3", "120")] }, { teamId: "a", targetTeamId: "b", date: "2026-11-22" }),
    ];
    const err = catchErr(() => calculateLedger(rows, products, { sprints }));
    expect(err.details).toMatchObject({ teamId: "b", recordId: rows[1].id, kind: "sale" });
  });
});

describe("a sale with a posted customer refund (bug 4)", () => {
  const setup = () => {
    const sale = e("sale", { lines: [L("5", "150")] }, { date: "2026-11-19" });
    const refund = e("customer_refund", { lines: [L("2", "150")], sourceId: sale.id, reason: "back" }, { date: "2026-11-20" });
    return { purchase: e("purchase", { lines: [L("5")] }, { date: "2026-11-18" }), sale, refund };
  };
  it("voiding the sale names the product and the refund's date", () => {
    const { purchase, sale, refund } = setup();
    const err = catchErr(() => calculateLedger([purchase, { ...sale, status: "void" }, refund], products));
    expect(err.message).toBe("Earphone · Packet: this sale has a customer refund on 2026-11-20 — correct or void the refund first.");
    expect(err.details).toMatchObject({ code: "refund_conflict", recordId: refund.id, saleId: sale.id, productId: "p" });
    expect(toBangla(err.message)).toContain("এই বিক্রির বিপরীতে 2026-11-20 তারিখে কাস্টমার রিফান্ড আছে — আগে রিফান্ডটি ঠিক/বাতিল করুন");
    expect(toBangla(`Team "TEAM 1" — ${err.message}`)).toContain("“TEAM 1” টিমের “Earphone · Packet”");
  });
  it("moving the sale after the refund or changing its product gives the same clear error", () => {
    const { purchase, sale, refund } = setup();
    expect(() => calculateLedger([purchase, { ...sale, date: "2026-11-21" }, refund], products)).toThrow(/customer refund on 2026-11-20/);
    const moved = { ...sale, data: { lines: [L("5", "150", "q")] } };
    expect(() => calculateLedger([purchase, e("purchase", { lines: [L("5", "100", "q")] }, { date: "2026-11-18" }), moved, refund], products)).toThrow(/customer refund on 2026-11-20/);
  });
  it("reducing the sale below the refunded quantity explains the numbers", () => {
    const { purchase, sale, refund } = setup();
    const err = catchErr(() => calculateLedger([purchase, { ...sale, data: { lines: [L("1", "150")] } }, refund], products));
    expect(err.message).toBe("Earphone · Packet: cannot return more than the remaining quantity of the sale (sold: 1.000, already returned: 0.000, refund on 2026-11-20: 2.000).");
    expect(toBangla(err.message)).toContain("আগে রিফান্ডটি ঠিক/বাতিল করুন");
  });
});

describe("duplicate product lines are checked as one total (bug 5)", () => {
  it("reports the total needed across the lines", () => {
    const rows = [
      e("purchase", { lines: [L("3")] }, { date: "2026-11-18" }),
      e("sale", { lines: [L("1", "150", "q"), L("2", "150"), L("2", "150")] }, { date: "2026-11-19" }),
      e("purchase", { lines: [L("1", "100", "q")] }, { date: "2026-11-18" }),
    ];
    const err = catchErr(() => calculateLedger(rows, products));
    expect(err.message).toBe(
      "Earphone · Packet: more than the available stock on 2026-11-19 (in stock: 3.000, needed: 4.000 in total across 2 lines; entry: Sale).",
    );
    expect(err.details).toMatchObject({ productId: "p", recordId: rows[1].id, lineIndex: 2, lineCount: 2, needed: 4000, inStock: 3000 });
    const bn = toBangla(err.message);
    expect(bn).toContain("2টি লাইনে মিলিয়ে মোট 4 টি লাগবে");
    expect(bn).toContain("মাত্র 3 টি");
  });
  it("still allows lines that fit together", () => {
    const rows = [
      e("purchase", { lines: [L("4")] }),
      e("sale", { lines: [L("2", "150"), L("2", "150")] }),
    ];
    expect(calculateLedger(rows, products).stocks["a|p"].quantity).toBe(0);
  });
});

describe("error details reach the client (bug 6)", () => {
  const shortRows = () => {
    const purchase = e("purchase", { lines: [L("2")] }, { date: "2026-11-18" });
    const sale = e("sale", { lines: [L("1", "150", "q"), L("2", "150")] }, { date: "2026-11-19", enteredByName: "Rahim" });
    return { purchase, sale, rows: [purchase, e("purchase", { lines: [L("1", "100", "q")] }, { date: "2026-11-18" }), sale] };
  };
  it("marks a short entry that is not the changed one as a later entry", () => {
    const { purchase, sale, rows } = shortRows();
    const shrunk = { ...purchase, data: { lines: [L("1")] } };
    const raw = catchErr(() => calculateLedger(rows.map((r) => (r.id === purchase.id ? shrunk : r)), products));
    expect(raw.details).toMatchObject({ recordId: sale.id, kind: "sale", date: "2026-11-19", lineIndex: 1, enteredByName: "Rahim" });
    const later = explainStockError(raw, [purchase.id]) as IncubationError;
    expect(later.message).toBe(
      "Earphone · Packet: more than the available stock on 2026-11-19 (in stock: 1.000, needed: 2.000; later entry: Sale by Rahim).",
    );
    expect(later.details).toMatchObject({ later: true, recordId: sale.id });
    expect(toBangla(later.message)).toContain("পরের একটি বিক্রয় (Sale) এন্ট্রিতে (এন্ট্রি দিয়েছেন: Rahim)");
    // The changed entry itself is left as is.
    expect(explainStockError(raw, [sale.id])).toBe(raw);
    // Team prefix (added by the server) is kept, and the correction wrapper still translates.
    const withTeam = explainStockError(
      new IncubationError(`Team "T1" — ${raw.message}`, 400, { ...raw.details, teamName: "T1" }),
      [purchase.id],
    ) as IncubationError;
    expect(withTeam.message.startsWith('Team "T1" — Earphone · Packet')).toBe(true);
    expect(toBangla(`Approving this correction would break stock: ${withTeam.message}`)).toContain("এই সংশোধন অনুমোদন করা যাচ্ছে না");
  });
  it("failure() passes details through to the JSON body", async () => {
    const { rows } = shortRows();
    const raw = catchErr(() => calculateLedger(rows.map((r, i) => (i === 0 ? { ...r, data: { lines: [L("1")] } } : r)), products));
    const res = failure(raw);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorEn).toBe(raw.message);
    expect(body.details).toMatchObject({ code: "stock_short", productId: "p", recordId: rows[2].id, lineIndex: 1, kind: "sale" });
    expect(errorDetails(undefined)).toBeUndefined();
    expect(errorDetails({ secret: "x" })).toBeUndefined();
  });
});

describe("reports with product filters (bug 7)", () => {
  it("filtering a sale's lines does not re-run the cash-difference rule", () => {
    const rows = [
      e("purchase", { lines: [L("5", "10"), L("5", "10", "q")] }),
      e("sale", { areaId: "x", lines: [{ ...L("1", "20"), cash: "40" }, { ...L("1", "20", "q"), cash: "0" }] }),
    ];
    const teams = [{ id: "a", name: "A" }];
    expect(buildReport(rows, products, teams).summaries[0].revenue).toBe(4000);
    const r = buildReport(rows, products, teams, { productId: "p" });
    expect(r.summaries[0]).toMatchObject({ revenue: 2000, received: 4000, variance: -2000 });
    // Submitting such a sale is still checked.
    expect(() => calculateLedger([rows[0], { ...rows[1], data: { lines: [rows[1].data.lines![0]] } }], products)).toThrow(/reason/);
  });
});

describe("program totals reconcile with team rows (bug 9)", () => {
  it("exposes the internal transfer adjustment", () => {
    const rows = [
      e("purchase", { lines: [L("2", "100")] }),
      e("transfer", { lines: [L("2", "150")] }, { targetTeamId: "b" }),
      e("expense", { amount: "10" }, { teamId: "b" }),
    ];
    const r = buildReport(rows, products, [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
    const teamSum = r.summaries.reduce((n, s) => n + s.netProfit, 0);
    expect(teamSum).toBe(10000 - 1000);
    expect(r.totals.teamsNetProfit).toBe(teamSum);
    expect(r.totals.internalTransferAdjustment).toBe(-10000);
    expect(r.totals.netProfit).toBe(teamSum + r.totals.internalTransferAdjustment);
    expect(r.totals.stockValue).toBe(r.totals.teamsStockValue + r.totals.internalStockAdjustment);
    expect(r.totals.stockValue).toBe(20000);
    // Filtered to one team: no adjustment, totals equal that team's row.
    const one = buildReport(rows, products, [{ id: "a", name: "A" }, { id: "b", name: "B" }], { teamId: "a" });
    expect(one.totals.internalTransferAdjustment).toBe(0);
    expect(one.totals.netProfit).toBe(one.summaries[0].netProfit);
  });
});

describe("sheet save keeps details and the row marker on ledger errors (bug 9)", () => {
  const deps = (recompute: () => Promise<unknown>): SheetDeps => {
    const record = { id: "r-purchase", programId: "prog", status: "posted", version: 1 };
    return {
      tx: {
        incubationRecord: {
          findFirst: async () => record,
          update: async () => ({ ...record, status: "void", version: 2 }),
        },
      } as unknown as SheetDeps["tx"],
      actor: { id: "u", displayName: "Staff", courseId: "c" },
      program: { id: "prog" } as SheetDeps["program"],
      entrySchema: {} as SheetDeps["entrySchema"],
      validate: async () => ({}),
      recompute,
      audit: async () => null,
      json: (v) => v as never,
    };
  };
  it("points at the later entry's line and translates the inner stock message", async () => {
    const inner = new IncubationError(
      'Team "T1" — Earphone · Packet: more than the available stock on 2026-11-19 (in stock: 0.000, needed: 2.000; entry: Sale).',
      400,
      {
        code: "stock_short",
        teamId: "t1",
        teamName: "T1",
        productId: "p",
        productName: "Earphone · Packet",
        recordId: "r-sale",
        kind: "sale",
        date: "2026-11-19",
        lineIndex: 1,
        lineCount: 1,
        needed: 2000,
        inStock: 0,
      },
    );
    let err: IncubationError | undefined;
    try {
      await sheetSave(
        deps(async () => {
          throw inner;
        }),
        { reason: "fix rows", voids: [{ recordId: "r-purchase", version: 1 }] },
      );
    } catch (x) {
      err = x as IncubationError;
    }
    expect(err).toBeInstanceOf(IncubationError);
    expect(err!.message.startsWith("[[r-sale:1]] These changes would break the stock or cash rules: ")).toBe(true);
    expect(err!.message).toContain("later entry: Sale");
    expect(err!.details).toMatchObject({ code: "stock_short", recordId: "r-sale", productId: "p", lineIndex: 1, rowKey: "r-sale:1", later: true });
    const bn = toBangla(err!.message);
    expect(bn.startsWith("[[r-sale:1]] ")).toBe(true);
    expect(bn).toContain("এই পরিবর্তনগুলো সেভ করলে স্টক বা ক্যাশের হিসাব ভেঙে যায়");
    expect(bn).toContain("“T1” টিমের “Earphone · Packet”");
  });
});
