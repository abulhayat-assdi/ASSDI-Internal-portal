import {
  calculateLedger,
  lineTotal,
  scaled,
  insist,
  validDate,
  type Entry,
  type Product,
} from "./domain";
export interface ReportFilters {
  from?: string;
  to?: string;
  teamId?: string;
  categoryId?: string;
  productId?: string;
  areaId?: string;
  batchName?: string;
}
export function buildReport(
  records: Entry[],
  products: Product[],
  allTeams: { id: string; name: string; batchName?: string }[],
  filters: ReportFilters = {},
) {
  const teams = allTeams.filter(
    (t) => !filters.batchName || t.batchName === filters.batchName,
  );
  insist(
    (!filters.from || validDate(filters.from)) &&
      (!filters.to || validDate(filters.to)) &&
      (!filters.from || !filters.to || filters.from <= filters.to),
    "রিপোর্টের তারিখের সীমা সঠিক নয়।",
  );
  const productScope = !!(filters.categoryId || filters.productId);
  const selected = new Set(
    products
      .filter(
        (p) =>
          (!filters.categoryId || p.parentId === filters.categoryId) &&
          (!filters.productId || p.id === filters.productId),
      )
      .map((p) => p.id),
  );
  const scope = records
    .filter(
      (r) => r.status === "posted" && (!filters.to || r.date <= filters.to),
    )
    .map((r) => ({
      ...r,
      data: {
        ...r.data,
        lines: r.data.lines?.filter((l) => selected.has(l.productId)),
      },
    }))
    .filter(
      (r) =>
        !productScope ||
        !!r.data.lines?.length ||
        (!filters.productId && r.data.categoryId === filters.categoryId),
    );
  const end = calculateLedger(scope, products),
    before = calculateLedger(
      scope.filter((r) => !!filters.from && r.date < filters.from),
      products,
    );
  const flowKeys = [
    "funding",
    "principalReturned",
    "purchases",
    "received",
    "revenue",
    "refunds",
    "expenses",
    "costOfSales",
    "returnGain",
    "damage",
    "variance",
    "grossProfit",
    "netProfit",
  ] as const;
  const visible = scope.filter(
    (r) =>
      (!filters.from || r.date >= filters.from) &&
      (!filters.teamId ||
        r.teamId === filters.teamId ||
        r.targetTeamId === filters.teamId) &&
      (!filters.areaId || r.data.areaId === filters.areaId) &&
      teams.some((t) => t.id === r.teamId || t.id === r.targetTeamId),
  );
  const summaries = teams
    .filter((t) => !filters.teamId || filters.teamId === t.id)
    .map((t) => {
      const e = end.summaries.find((s) => s.teamId === t.id),
        b = before.summaries.find((s) => s.teamId === t.id);
      const base = {
        teamId: t.id,
        teamName: t.name,
        cash: e?.cash || 0,
        openingCash: b?.cash || 0,
        stockValue: e?.stockValue || 0,
        principalOutstanding: e?.principalOutstanding || 0,
        cashDifference: e?.cashDifference ?? null,
      };
      const flows = Object.fromEntries(
        flowKeys.map((k) => [k, (e?.[k] || 0) - (b?.[k] || 0)]),
      ) as Record<(typeof flowKeys)[number], number>;
      if (filters.areaId) {
        for (const k of flowKeys) flows[k] = 0;
        for (const r of visible) {
          const effect = end.effects[r.id]?.[t.id];
          if (effect)
            for (const k of [
              "funding",
              "principalReturned",
              "purchases",
              "received",
              "revenue",
              "refunds",
              "expenses",
              "costOfSales",
              "returnGain",
              "damage",
              "variance",
            ] as const)
              flows[k] += effect[k];
        }
        flows.grossProfit = flows.revenue - flows.costOfSales;
        flows.netProfit =
          flows.grossProfit - flows.expenses - flows.damage + flows.returnGain;
      }
      return {
        ...base,
        ...flows,
        internalMarginChange:
          (e?.internalMargin || 0) - (b?.internalMargin || 0),
        internalMargin: e?.internalMargin || 0,
      };
    });
  const trend = Object.entries(
    visible
      .filter(
        (r) =>
          ["sale", "customer_refund"].includes(r.kind) &&
          (!filters.teamId || r.teamId === filters.teamId),
      )
      .reduce<Record<string, number>>((a, r) => {
        a[r.date] =
          (a[r.date] || 0) +
          (r.kind === "customer_refund" ? -1 : 1) *
            (r.data.lines || []).reduce(
              (n, l) => n + lineTotal(l.quantity, l.unitPrice || "0"),
              0,
            );
        return a;
      }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue: revenue / 100 }));
  const inventory = Object.entries(end.stocks)
    .filter(
      ([key]) =>
        (!filters.teamId || key.startsWith(`${filters.teamId}|`)) &&
        teams.some((t) => key.startsWith(`${t.id}|`)),
    )
    .map(([key, s]) => {
      const [teamId, productId] = key.split("|");
      return {
        teamId,
        productId,
        teamName: teams.find((t) => t.id === teamId)?.name || "",
        productName: products.find((p) => p.id === productId)?.name || "",
        unit: products.find((p) => p.id === productId)?.unit || "",
        ...s,
      };
    });
  const totals = summaries.reduce(
    (a, s) => ({
      revenue: a.revenue + s.revenue,
      expenses: a.expenses + s.expenses,
      netProfit: a.netProfit + s.netProfit,
      cash: a.cash + s.cash,
      stockValue: a.stockValue + s.stockValue,
      principalOutstanding: a.principalOutstanding + s.principalOutstanding,
      variance: a.variance + s.variance,
    }),
    {
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      cash: 0,
      stockValue: 0,
      principalOutstanding: 0,
      variance: 0,
    },
  );
  if (!filters.teamId && !filters.areaId && !filters.batchName) {
    totals.netProfit -= summaries.reduce(
      (n, s) => n + s.internalMarginChange,
      0,
    );
    totals.stockValue -= summaries.reduce((n, s) => n + s.internalMargin, 0);
  }
  return {
    summaries,
    trend,
    inventory,
    records: visible,
    filters,
    productScope,
    totals,
  };
}
export function reportRows(
  record: Entry,
  products: Product[],
  teamName: string,
): Record<string, unknown>[] {
  const base = {
    "Record ID": record.id,
    Date: record.date,
    "Submitted At": new Date(record.createdAt).toISOString(),
    Team: teamName,
    Kind: record.kind,
    Status: record.status,
    "Submitted By": record.enteredByName || "",
  };
  if (record.data.lines?.length)
    return record.data.lines.map((l) => ({
      ...base,
      Product: products.find((p) => p.id === l.productId)?.name || l.productId,
      Quantity: scaled(l.quantity, 3) / 1000,
      "Unit Price": scaled(l.unitPrice || "0") / 100,
      Amount: lineTotal(l.quantity, l.unitPrice || "0") / 100,
      "Cash Received":
        record.kind === "sale"
          ? l.cash === undefined
            ? lineTotal(l.quantity, l.unitPrice || "0") / 100
            : scaled(l.cash) / 100
          : "",
      Note: record.data.note || "",
      Reason: record.data.reason || "",
    }));
  const learning =
    record.kind === "fgd"
      ? Object.fromEntries([
          ...(record.data.findings || []).map((v, i) => [
            `Finding ${i + 1}`,
            v,
          ]),
          ...(record.data.actions || []).map((v, i) => [`Action ${i + 1}`, v]),
        ])
      : record.kind === "insight"
        ? {
            "Customer Segment": record.data.segment,
            Objections: record.data.objections,
            "Why Bought": record.data.whyBought,
            "Best Area": record.data.bestArea,
          }
        : {};
  return [
    {
      ...base,
      Amount: record.data.amount ? scaled(record.data.amount) / 100 : 0,
      Note: record.data.note || "",
      Reason: record.data.reason || "",
      ...learning,
    },
  ];
}
