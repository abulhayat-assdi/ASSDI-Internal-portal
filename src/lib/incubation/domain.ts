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
    /** Structured context (e.g. which team/product ran short) for clearer messages. */
    public details?: Record<string, unknown>,
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
/** A team's sprint window. Inside a sprint, every purchase the team records
 * (and every transfer it receives) counts as stock from the first day of that
 * sprint — including purchases dated on that first day itself — so a sale that
 * is entered late (or dated before the purchase was entered) is checked against
 * everything bought in the sprint, not only what was bought before the sale's
 * date. Cash and all money figures still use each entry's own date. */
export interface StockWindow {
  teamId: string;
  startDate: string;
  endDate: string;
}
export interface LedgerOptions {
  sprints?: StockWindow[];
  /** Dates at which to snapshot the ledger state (state before anything on/after that date). */
  cuts?: string[];
  /** Report mode: the caller may have filtered product lines out of entries, so
   * skip checks that only make sense for a whole entry as submitted (e.g. "cash
   * differs from the sale amount needs a reason", "add product lines"). Stock
   * and money rules still apply. */
  reportMode?: boolean;
}
/** Structured context of a stock shortfall (IncubationError.details). */
export interface StockShortDetails {
  code: "stock_short";
  teamId: string;
  teamName?: string;
  productId: string;
  productName: string;
  recordId: string;
  kind: string;
  date: string;
  /** Index of the line in the entry where the product ran out. */
  lineIndex: number;
  /** How many lines of the entry carry this product. */
  lineCount: number;
  /** Total quantity (1/1000 unit) the entry needs of this product. */
  needed: number;
  /** Quantity (1/1000 unit) the team had at that point. */
  inStock: number;
  enteredByName?: string;
  [key: string]: unknown;
}
/** English text for a stock shortfall. `later` marks that the short entry is
 * not the one being changed but a later entry that relied on that stock. */
export function stockShortMessage(d: StockShortDetails, later = false) {
  const needed =
    d.lineCount > 1
      ? `${decimal(d.needed, 3)} in total across ${d.lineCount} lines`
      : decimal(d.needed, 3);
  const kind = KIND_LABELS[d.kind as RecordKind] ?? d.kind;
  const entry = later
    ? `later entry: ${kind}${d.enteredByName ? ` by ${d.enteredByName}` : ""}`
    : `entry: ${kind}`;
  return `${d.productName}: more than the available stock on ${d.date} (in stock: ${decimal(d.inStock, 3)}, needed: ${needed}; ${entry}).`;
}
/**
 * When a change (sheet save, correction) makes the ledger fail on an entry that
 * is NOT one of the changed entries, say so: the short entry is a later entry
 * that relied on the stock. Other errors are returned unchanged.
 */
export function explainStockError(error: unknown, changedIds: Iterable<string>) {
  if (!(error instanceof IncubationError) || error.details?.code !== "stock_short")
    return error;
  const d = error.details as StockShortDetails;
  const changed = new Set(changedIds);
  if (changed.has(d.recordId)) return error;
  return new IncubationError(
    `${d.teamName ? `Team "${d.teamName}" — ` : ""}${stockShortMessage(d, true)}`,
    error.status,
    { ...d, later: true },
  );
}
type LedgerState = ReturnType<typeof summarize>;
function summarize(
  finances: Record<string, Finance>,
  stocks: Record<string, Stock>,
) {
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
  return { stocks, summaries };
}
/** The first day of the team's sprint that contains `date` (or `date` itself
 * when it is not inside one of the team's sprints). */
export function stockDate(
  sprints: StockWindow[] | undefined,
  teamId: string,
  date: string,
) {
  const s = sprints?.find(
    (s) => s.teamId === teamId && s.startDate <= date && s.endDate >= date,
  );
  return s && s.startDate < date ? s.startDate : date;
}
type SaleLine = {
  quantity: number;
  refunded: number;
  revenue: number;
  cost: number;
  restored: number;
  returnedCost: number;
  margin: number;
  returnedMargin: number;
};
/**
 * Replays every posted entry and returns each team's stock and finances.
 *
 * Order of processing (per date): first all stock that arrives that day —
 * purchases, then goods received from other teams, then saleable customer
 * returns of earlier sales — and only then everything else in the order it
 * was entered. So the order entries were typed in on a day never matters for
 * stock. Inside a team's sprint, purchases (and goods received) count from the
 * sprint's first day. Money always moves on the entry's own date.
 *
 * A transfer is credited to the receiver early (at the receiver's sprint start,
 * or at the start of the transfer's own date) only when the sender holds that
 * stock at that point; otherwise it arrives together with the sender's debit.
 * The sender is always debited on the transfer's real date, so one team's
 * transfer never changes how another team's stock is counted.
 */
export function calculateLedger(
  entries: Entry[],
  products: Product[],
  options: LedgerOptions = {},
) {
  const stocks: Record<string, Stock> = {},
    finances: Record<string, Finance> = {};
  const productMap = new Map(products.map((p) => [p.id, p]));
  const productName = (p: Product) => [p.name, p.variant].filter(Boolean).join(" · ");
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
  const saleLines = new Map<string, Map<string, SaleLine>>();
  const effects: Record<string, Record<string, Finance>> = {};
  const sequence = (a: Entry, b: Entry) =>
    a.date.localeCompare(b.date) ||
    (a.entryOrder !== undefined && b.entryOrder !== undefined
      ? a.entryOrder - b.entryOrder
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) ||
    a.id.localeCompare(b.id);
  const posted = entries.filter((r) => r.status === "posted");
  const postedById = new Map(posted.map((r) => [r.id, r]));
  // Phases inside one date: 0 purchases in, 1 transfers in, 2 customer returns
  // of earlier sales back into stock, 3 everything else in entry order.
  type Part = "all" | "stock" | "money" | "in" | "out";
  type Step = { r: Entry; at: string; phase: number; part: Part };
  const steps: Step[] = [];
  for (const r of posted) {
    if (r.kind === "purchase") {
      steps.push(
        { r, at: stockDate(options.sprints, r.teamId, r.date), phase: 0, part: "stock" },
        { r, at: r.date, phase: 3, part: "money" },
      );
    } else if (r.kind === "transfer") {
      if (r.targetTeamId) {
        const pull = stockDate(options.sprints, r.targetTeamId, r.date);
        if (pull < r.date) steps.push({ r, at: pull, phase: 1, part: "in" });
        steps.push({ r, at: r.date, phase: 1, part: "in" });
      }
      steps.push({ r, at: r.date, phase: 3, part: "out" });
    } else if (r.kind === "customer_refund") {
      const sale = postedById.get(r.data.sourceId || "");
      if (sale && sale.kind === "sale" && sale.date < r.date)
        steps.push(
          { r, at: r.date, phase: 2, part: "stock" },
          { r, at: r.date, phase: 3, part: "money" },
        );
      else steps.push({ r, at: r.date, phase: 3, part: "all" });
    } else steps.push({ r, at: r.date, phase: 3, part: "all" });
  }
  steps.sort(
    (a, b) => a.at.localeCompare(b.at) || a.phase - b.phase || sequence(a.r, b.r),
  );
  /** Transfers already credited to the receiver, and stock each sender still owes them. */
  const credited = new Set<string>();
  const promised: Record<string, number> = {};
  const refundCash = new Map<string, number>();
  const cuts = [...new Set(options.cuts || [])].sort();
  const snapshots: Record<string, LedgerState> = {};
  const snap = (cut: string) =>
    (snapshots[cut] = summarize(
      JSON.parse(JSON.stringify(finances)),
      JSON.parse(JSON.stringify(stocks)),
    ));
  for (const { r, at, part } of steps) {
    while (cuts.length && cuts[0] <= at) snap(cuts.shift()!);
    if (!FINANCIAL_KINDS.includes(r.kind as RecordKind)) continue;
    const before = JSON.parse(JSON.stringify(finances)) as Record<
      string,
      Finance
    >;
    const f = finance(r.teamId),
      d = r.data;
    // Effects of an entry add up over its steps (stock part, money part).
    const recordEffects = () => {
      const e = (effects[r.id] ??= {});
      for (const teamId of [
        r.teamId,
        ...(r.targetTeamId ? [r.targetTeamId] : []),
      ]) {
        const current = finance(teamId),
          previous = before[teamId] || emptyFinance(),
          sofar = e[teamId];
        insist(
          Object.values(current).every(
            (v) => v === null || Number.isSafeInteger(v),
          ),
          "Amount exceeds the allowed limit.",
        );
        e[teamId] = Object.fromEntries(
          Object.keys(current).map((k) => [
            k,
            k === "countedCash"
              ? null
              : ((sofar?.[k as keyof Finance] as number) || 0) +
                (current[k as keyof Finance] || 0) -
                (previous[k as keyof Finance] || 0),
          ]),
        ) as unknown as Finance;
      }
    };
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
    if (options.reportMode && !d.lines?.length) continue;
    insist(
      d.lines?.length && d.lines.length <= 100,
      "Add product lines (up to 100).",
    );
    const lines = d.lines.map((line, index) => {
      const p = productMap.get(line.productId);
      insist(p, "Product not found.");
      const q = scaled(line.quantity, 3);
      insist(q > 0, `${p.name}: quantity must be greater than zero.`);
      return { line, index, p, q };
    });
    // Check the whole entry at once, so the same product on several lines is
    // compared as one total against the stock.
    const ensureStock = (team: string, have: (productId: string) => number) => {
      const totals = new Map<string, { q: number; count: number }>();
      for (const { p, q } of lines) {
        const t = totals.get(p.id) ?? { q: 0, count: 0 };
        t.q += q;
        t.count++;
        totals.set(p.id, t);
      }
      for (const [productId, t] of totals) {
        const inStock = have(productId);
        if (inStock >= t.q) continue;
        let sum = 0;
        const short = lines.find(
          (l) => l.p.id === productId && (sum += l.q) > inStock,
        )!;
        const details: StockShortDetails = {
          code: "stock_short",
          teamId: team,
          productId,
          productName: productName(short.p),
          recordId: r.id,
          kind: r.kind,
          date: r.date,
          lineIndex: short.index,
          lineCount: t.count,
          needed: t.q,
          inStock,
          ...(r.enteredByName ? { enteredByName: r.enteredByName } : {}),
        };
        throw new IncubationError(stockShortMessage(details), 400, details);
      }
    };
    if (r.kind === "purchase") {
      for (const { line, p, q } of lines) {
        const amount = lineTotal(line.quantity, line.unitPrice ?? "0");
        if (part === "stock") {
          const s = stock(r.teamId, p.id);
          s.quantity += q;
          s.value += amount;
          s.procured += q;
        } else {
          f.purchases += amount;
          f.cash -= amount;
        }
      }
      recordEffects();
      continue;
    }
    if (r.kind === "transfer") {
      if (part === "in") {
        if (credited.has(r.id)) continue;
        if (!r.targetTeamId || r.targetTeamId === r.teamId) continue;
        // Only when the sender really holds this stock at this point.
        const free = (productId: string) =>
          stock(r.teamId, productId).quantity -
          (promised[`${r.teamId}|${productId}`] || 0);
        const need = new Map<string, number>();
        for (const { p, q } of lines) need.set(p.id, (need.get(p.id) || 0) + q);
        if ([...need].some(([productId, q]) => free(productId) < q)) continue;
        for (const { line, p, q } of lines) {
          const dest = stock(r.targetTeamId, p.id);
          dest.quantity += q;
          dest.value += lineTotal(line.quantity, line.unitPrice ?? "0");
          dest.procured += q;
          const key = `${r.teamId}|${p.id}`;
          promised[key] = (promised[key] || 0) + q;
        }
        credited.add(r.id);
        continue;
      }
      insist(
        r.targetTeamId && r.targetTeamId !== r.teamId,
        "Invalid receiving team.",
      );
      ensureStock(r.teamId, (productId) => stock(r.teamId, productId).quantity);
      const early = credited.has(r.id);
      const destF = finance(r.targetTeamId);
      for (const { line, p, q } of lines) {
        const s = stock(r.teamId, p.id),
          dest = stock(r.targetTeamId, p.id);
        const amount = lineTotal(line.quantity, line.unitPrice ?? "0");
        const cost = q === s.quantity ? s.value : ratio(s.value, q, s.quantity);
        const margin =
          q === s.quantity ? s.internalMargin : ratio(s.internalMargin, q, s.quantity);
        s.internalMargin -= margin;
        s.quantity -= q;
        s.value -= cost;
        s.returned += q;
        f.cash += amount;
        f.returnGain += amount - cost;
        destF.cash -= amount;
        destF.purchases += amount;
        const internal = amount - cost + margin;
        if (early) {
          const key = `${r.teamId}|${p.id}`;
          promised[key] = (promised[key] || 0) - q;
          // The goods were already counted at the receiver; any part of them
          // the receiver has sold since then has realised its internal markup.
          dest.internalMargin +=
            dest.quantity >= q ? internal : ratio(internal, dest.quantity, q);
        } else {
          dest.quantity += q;
          dest.value += amount;
          dest.procured += q;
          dest.internalMargin += internal;
        }
      }
      recordEffects();
      continue;
    }
    if (r.kind === "customer_refund") {
      if (part !== "money") {
        let total = 0;
        const sale = postedById.get(d.sourceId || "");
        for (const { line, p, q, index } of lines) {
          const label = productName(p);
          const original = saleLines.get(d.sourceId || "")?.get(p.id);
          const refundDetails = {
            code: "refund_conflict",
            teamId: r.teamId,
            productId: p.id,
            productName: label,
            recordId: r.id,
            saleId: d.sourceId,
            kind: r.kind,
            date: r.date,
            lineIndex: index,
            ...(r.enteredByName ? { enteredByName: r.enteredByName } : {}),
          };
          // The sale was voided, moved after the refund or no longer has this
          // product: the refund has to be fixed first.
          if (!original)
            throw new IncubationError(
              `${label}: this sale has a customer refund on ${r.date} — correct or void the refund first.`,
              400,
              { ...refundDetails, saleDate: sale?.date },
            );
          if (original.quantity - original.refunded < q)
            throw new IncubationError(
              `${label}: cannot return more than the remaining quantity of the sale (sold: ${decimal(original.quantity, 3)}, already returned: ${decimal(original.refunded, 3)}, refund on ${r.date}: ${decimal(q, 3)}).`,
              400,
              { ...refundDetails, saleDate: sale?.date },
            );
          const s = stock(r.teamId, p.id);
          const amount = lineTotal(line.quantity, line.unitPrice ?? "0");
          const remainingRefund = original.revenue - original.restored;
          insist(
            amount <= remainingRefund,
            "Cannot refund more than the remaining amount of the original sale.",
          );
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
          f.refunds += amount;
          f.costOfSales -= cost;
          total += amount;
          if (d.saleable !== false) {
            s.quantity += q;
            s.value += cost;
            s.internalMargin += margin;
          } else f.damage += cost;
        }
        if (part === "all") f.cash -= total;
        else refundCash.set(r.id, total);
      } else f.cash -= refundCash.get(r.id) || 0;
      recordEffects();
      continue;
    }
    if (!["sale", "damage", "supplier_return"].includes(r.kind))
      throw new IncubationError("Invalid record type.");
    ensureStock(r.teamId, (productId) => stock(r.teamId, productId).quantity);
    let saleTotal = 0,
      saleCash = 0;
    const sales = new Map<string, SaleLine>();
    for (const { line, p, q } of lines) {
      const s = stock(r.teamId, p.id);
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
      } else {
        const amount = lineTotal(line.quantity, line.unitPrice ?? "0");
        s.returned += q;
        f.cash += amount;
        f.returnGain += amount - cost;
      }
    }
    if (r.kind === "sale") {
      insist(
        options.reportMode ||
          saleTotal === saleCash ||
          (d.reason || "").trim().length >= 3,
        "Enter a reason when cash received differs from the sale amount.",
      );
      f.variance += saleTotal - saleCash;
      saleLines.set(r.id, sales);
    }
    recordEffects();
  }
  for (const cut of cuts) snap(cut);
  return { ...summarize(finances, stocks), effects, snapshots };
}
