/** Pure stock/accounting engine. Money is integer paisa; quantity is 1/1000 unit.
 * All products are costed by moving weighted average, with integer rounding. */
export type RecordKind =
  | "purchase"
  | "sale"
  | "supplier_return"
  | "transfer"
  | "customer_refund"
  | "damage"
  | "expense"
  | "fund"
  | "repayment"
  | "cash_count"
  | "fgd"
  | "insight";
export const FINANCIAL_KINDS: RecordKind[] = [
  "purchase",
  "sale",
  "supplier_return",
  "transfer",
  "customer_refund",
  "damage",
  "expense",
  "fund",
  "repayment",
  "cash_count",
];
export const KIND_LABELS: Record<RecordKind, string> = {
  purchase: "Purchase",
  sale: "Sale",
  supplier_return: "Supplier return",
  transfer: "Transfer to team",
  customer_refund: "Customer refund",
  damage: "Damage",
  expense: "Expense",
  fund: "Funding",
  repayment: "Principal repayment",
  cash_count: "Cash count",
  fgd: "FGD",
  insight: "Market Insights",
};
export class IncubationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function insist(
  value: unknown,
  message: string,
  status = 400,
): asserts value {
  if (!value) throw new IncubationError(message, status);
}
export function scaled(value: unknown, digits = 2): number {
  const s = String(value ?? "").trim();
  insist(
    new RegExp(`^\\d{1,9}(?:\\.\\d{1,${digits}})?$`).test(s),
    `Enter a valid number (up to ${digits} decimal places).`,
  );
  const [a, b = ""] = s.split(".");
  const n = Number(a) * 10 ** digits + Number(b.padEnd(digits, "0"));
  insist(Number.isSafeInteger(n), "Number is out of range.");
  return n;
}
export const decimal = (n: number, digits = 2) =>
  (n / 10 ** digits).toFixed(digits);
function ratio(a: number, b: number, denominator: number) {
  insist(
    [a, b, denominator].every(Number.isSafeInteger) && denominator > 0,
    "Invalid amount.",
  );
  const numerator = BigInt(a) * BigInt(b),
    negative = numerator < BigInt(0);
  const v =
    ((negative ? -numerator : numerator) +
      BigInt(Math.floor(denominator / 2))) /
    BigInt(denominator);
  insist(v <= BigInt(Number.MAX_SAFE_INTEGER), "Amount exceeds the allowed limit.");
  return Number(negative ? -v : v);
}
export const lineTotal = (quantity: unknown, price: unknown) =>
  ratio(scaled(quantity, 3), scaled(price), 1000);
export const todayDhaka = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(date);
export function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}
export function isLate(date: string, today = todayDhaka()) {
  return (
    Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`) >
    86400000
  );
}
export interface Product {
  id: string;
  name: string;
  variant?: string;
  parentId: string | null;
  unit: string;
  fractional: boolean;
  active: boolean;
}
export interface EntryLine {
  productId: string;
  quantity: string;
  unitPrice?: string;
  cash?: string;
}
export interface EntryData {
  lines?: EntryLine[];
  amount?: string;
  reason?: string;
  note?: string;
  voucherId?: string;
  areaId?: string;
  categoryId?: string;
  expenseType?: string;
  sourceId?: string;
  saleable?: boolean;
  session?: string;
  round?: string;
  findings?: string[];
  actions?: string[];
  segment?: string;
  objections?: string;
  whyBought?: string;
  bestArea?: string;
}
export interface Entry {
  enteredBy?: string;
  enteredByName?: string;
  entryOrder?: number;
  id: string;
  teamId: string;
  targetTeamId?: string | null;
  kind: string;
  date: string;
  status: string;
  data: EntryData;
  createdAt: Date | string;
}
export interface Stock {
  quantity: number;
  value: number;
  internalMargin: number;
  procured: number;
  sold: number;
  returned: number;
  damaged: number;
}
export interface Finance {
  funding: number;
  principalReturned: number;
  purchases: number;
  received: number;
  revenue: number;
  refunds: number;
  expenses: number;
  costOfSales: number;
  returnGain: number;
  damage: number;
  cash: number;
  variance: number;
  countedCash: number | null;
  cashAtCount: number | null;
}
const emptyFinance = (): Finance => ({
  funding: 0,
  principalReturned: 0,
  purchases: 0,
  received: 0,
  revenue: 0,
  refunds: 0,
  expenses: 0,
  costOfSales: 0,
  returnGain: 0,
  damage: 0,
  cash: 0,
  variance: 0,
  countedCash: null,
  cashAtCount: null,
});
export function calculateLedger(entries: Entry[], products: Product[]) {
  const stocks: Record<string, Stock> = {},
    finances: Record<string, Finance> = {};
  const productMap = new Map(products.map((p) => [p.id, p]));
  const stock = (team: string, product: string) =>
    (stocks[`${team}|${product}`] ??= {
      quantity: 0,
      value: 0,
      internalMargin: 0,
      procured: 0,
      sold: 0,
      returned: 0,
      damaged: 0,
    });
  const finance = (team: string) => (finances[team] ??= emptyFinance());
  const saleLines = new Map<
    string,
    Map<
      string,
      {
        quantity: number;
        refunded: number;
        revenue: number;
        cost: number;
        restored: number;
        returnedCost: number;
        margin: number;
        returnedMargin: number;
      }
    >
  >();
  const effects: Record<string, Record<string, Finance>> = {};
  const postings = entries
    .filter((r) => r.status === "posted")
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.entryOrder !== undefined && b.entryOrder !== undefined
          ? a.entryOrder - b.entryOrder
          : new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()) ||
        a.id.localeCompare(b.id),
    );
  for (const r of postings) {
    const before = JSON.parse(JSON.stringify(finances)) as Record<
      string,
      Finance
    >;
    const f = finance(r.teamId),
      d = r.data;
    const recordEffects = () => {
      effects[r.id] = {};
      for (const teamId of [
        r.teamId,
        ...(r.targetTeamId ? [r.targetTeamId] : []),
      ]) {
        const current = finance(teamId),
          previous = before[teamId] || emptyFinance();
        insist(
          Object.values(current).every(
            (v) => v === null || Number.isSafeInteger(v),
          ),
          "Amount exceeds the allowed limit.",
        );
        effects[r.id][teamId] = Object.fromEntries(
          Object.keys(current).map((k) => [
            k,
            k === "countedCash"
              ? null
              : (current[k as keyof Finance] || 0) -
                (previous[k as keyof Finance] || 0),
          ]),
        ) as unknown as Finance;
      }
    };
    if (!FINANCIAL_KINDS.includes(r.kind as RecordKind)) continue;
    if (["fund", "repayment", "expense", "cash_count"].includes(r.kind)) {
      const amount = scaled(d.amount);
      if (r.kind === "fund") {
        f.funding += amount;
        f.cash += amount;
      }
      if (r.kind === "repayment") {
        f.principalReturned += amount;
        f.cash -= amount;
        insist(
          f.principalReturned <= f.funding,
          "Repayment cannot exceed the funding received.",
        );
      }
      if (r.kind === "expense") {
        f.expenses += amount;
        f.cash -= amount;
      }
      if (r.kind === "cash_count") {
        f.countedCash = amount;
        f.cashAtCount = f.cash;
      }
      recordEffects();
      continue;
    }
    insist(
      d.lines?.length && d.lines.length <= 100,
      "Add product lines (up to 100).",
    );
    let saleTotal = 0,
      saleCash = 0;
    const sales = new Map<
      string,
      {
        quantity: number;
        refunded: number;
        revenue: number;
        cost: number;
        restored: number;
        returnedCost: number;
        margin: number;
        returnedMargin: number;
      }
    >();
    const refundedThisEntry = new Map<string, number>();
    for (const line of d.lines) {
      const p = productMap.get(line.productId);
      insist(p, "Product not found.");
      const q = scaled(line.quantity, 3);
      insist(
        q > 0 && (p.fractional || q % 1000 === 0),
        `${p.name}: quantity does not match the unit.`,
      );
      const s = stock(r.teamId, p.id);
      if (r.kind === "customer_refund") {
        const original = saleLines.get(d.sourceId || "")?.get(p.id);
        insist(
          original && original.quantity - original.refunded >= q,
          "Cannot return more than the remaining quantity of the original sale.",
        );
        const amount = lineTotal(line.quantity, line.unitPrice ?? "0");
        const previously = refundedThisEntry.get(p.id) || 0;
        const remainingRefund = original.revenue - original.restored;
        insist(
          amount <= remainingRefund,
          "Cannot refund more than the remaining amount of the original sale.",
        );
        refundedThisEntry.set(p.id, previously + amount);
        const last = original.refunded + q === original.quantity;
        const cost = last
          ? original.cost - original.returnedCost
          : ratio(original.cost, q, original.quantity);
        const margin = last
          ? original.margin - original.returnedMargin
          : ratio(original.margin, q, original.quantity);
        original.returnedCost += cost;
        original.returnedMargin += margin;
        original.refunded += q;
        original.restored += amount;
        f.revenue -= amount;
        f.cash -= amount;
        f.refunds += amount;
        f.costOfSales -= cost;
        if (d.saleable !== false) {
          s.quantity += q;
          s.value += cost;
          s.internalMargin += margin;
        } else f.damage += cost;
        continue;
      }
      if (r.kind === "purchase") {
        const amount = lineTotal(line.quantity, line.unitPrice ?? "0");
        s.quantity += q;
        s.value += amount;
        s.procured += q;
        f.purchases += amount;
        f.cash -= amount;
        continue;
      }
      // Sequential mutation also validates repeated product lines in a single form.
      insist(
        s.quantity >= q,
        `${p.name}: more than the available stock on ${r.date} (in stock: ${decimal(s.quantity, 3)}).`,
      );
      const cost = q === s.quantity ? s.value : ratio(s.value, q, s.quantity);
      const margin =
        q === s.quantity
          ? s.internalMargin
          : ratio(s.internalMargin, q, s.quantity);
      s.internalMargin -= margin;
      s.quantity -= q;
      s.value -= cost;
      if (r.kind === "sale") {
        const amount = lineTotal(line.quantity, line.unitPrice ?? "0");
        const cash = scaled(line.cash ?? decimal(amount));
        saleTotal += amount;
        saleCash += cash;
        s.sold += q;
        f.revenue += amount;
        f.received += cash;
        f.cash += cash;
        f.costOfSales += cost;
        const prior = sales.get(p.id) ?? {
          quantity: 0,
          refunded: 0,
          revenue: 0,
          cost: 0,
          restored: 0,
          returnedCost: 0,
          margin: 0,
          returnedMargin: 0,
        };
        prior.quantity += q;
        prior.revenue += amount;
        prior.cost += cost;
        prior.margin += margin;
        sales.set(p.id, prior);
      } else if (r.kind === "damage") {
        s.damaged += q;
        f.damage += cost;
      } else if (r.kind === "supplier_return" || r.kind === "transfer") {
        const amount = lineTotal(line.quantity, line.unitPrice ?? "0");
        s.returned += q;
        f.cash += amount;
        f.returnGain += amount - cost;
        if (r.kind === "transfer") {
          insist(
            r.targetTeamId && r.targetTeamId !== r.teamId,
            "Invalid receiving team.",
          );
          const dest = stock(r.targetTeamId, p.id),
            destF = finance(r.targetTeamId);
          dest.quantity += q;
          dest.value += amount;
          dest.procured += q;
          dest.internalMargin += amount - cost + margin;
          destF.cash -= amount;
          destF.purchases += amount;
        }
      } else throw new IncubationError("Invalid record type.");
    }
    if (r.kind === "sale") {
      insist(
        saleTotal === saleCash || (d.reason || "").trim().length >= 3,
        "Enter a reason when cash received differs from the sale amount.",
      );
      f.variance += saleTotal - saleCash;
      saleLines.set(r.id, sales);
    }
    recordEffects();
  }
  const summaries = Object.entries(finances).map(([teamId, f]) => ({
    teamId,
    ...f,
    grossProfit: f.revenue - f.costOfSales,
    netProfit: f.revenue - f.costOfSales - f.expenses - f.damage + f.returnGain,
    principalOutstanding: f.funding - f.principalReturned,
    cashDifference:
      f.countedCash === null ? null : f.countedCash - (f.cashAtCount ?? f.cash),
    stockValue: Object.entries(stocks)
      .filter(([k]) => k.startsWith(`${teamId}|`))
      .reduce((n, [, s]) => n + s.value, 0),
    internalMargin: Object.entries(stocks)
      .filter(([k]) => k.startsWith(`${teamId}|`))
      .reduce((n, [, s]) => n + s.internalMargin, 0),
  }));
  return { stocks, summaries, effects };
}
