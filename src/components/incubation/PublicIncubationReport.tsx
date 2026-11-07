"use client";
import ResultsCard from "./ResultsCard";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Sprout, Download } from "lucide-react";
import "./incubation.css";
import "./incubation-glass.css";
export default function PublicIncubationReport({ token }: { token: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [filters, setFilters] = useState({
      from: "",
      to: "",
      teamId: "",
      categoryId: "",
      productId: "",
      batchName: "",
      areaId: "",
    });
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  ).toString();
  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/incubation/public/${token}?${query}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [token, query]);
  const money = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "BDT",
    }).format((n || 0) / 100);
  return (
    <main className="inc" style={{ margin: "30px auto", maxWidth: 1200 }}>
      <header className="inc-head">
        <div className="inc-eyebrow">ASSDI · BUSINESS INCUBATION</div>
        <h1>{data?.program.name || "Business Incubation Report"}</h1>
        <p className="inc-sub">
          {data?.program.description || "Real business results by team"}
        </p>
        <div className="inc-row">
          <Sprout size={18} />
          <small>Published business report</small>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="inc-notice inc-error"
          style={{ marginTop: 20 }}
        >
          {error}
        </div>
      )}
      {!data && !error ? (
        <p style={{ padding: 40 }}>Loading report…</p>
      ) : data ? (
        <>
          <div className="inc-filters" style={{ marginTop: 20 }}>
            <label className="inc-field">
              Batch
              <select
                value={filters.batchName}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    batchName: e.target.value,
                    teamId: "",
                  })
                }
              >
                <option value="">All batches</option>
                {Array.from(
                  new Set<string>(data.teams.map((t: any) => t.batchName)),
                )
                  .filter(Boolean)
                  .map((n) => (
                    <option key={n}>{n}</option>
                  ))}
              </select>
            </label>
            <label className="inc-field">
              Sprint
              <select
                value={
                  data.sprints.find(
                    (s: any) =>
                      filters.from === s.startDate &&
                      filters.to === s.endDate &&
                      filters.teamId === s.teamId &&
                      filters.categoryId === s.categoryId,
                  )?.id || ""
                }
                onChange={(e) => {
                  const s = data.sprints.find(
                    (s: any) => s.id === e.target.value,
                  );
                  setFilters(
                    s
                      ? {
                          ...filters,
                          teamId: s.teamId,
                          categoryId: s.categoryId,
                          productId: "",
                          batchName: "",
                          from: s.startDate,
                          to: s.endDate,
                        }
                      : {
                          ...filters,
                          teamId: "",
                          categoryId: "",
                          from: "",
                          to: "",
                        },
                  );
                }}
              >
                <option value="">Custom dates / all</option>
                {data.sprints.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {data.teams.find((t: any) => t.id === s.teamId)?.name} •{" "}
                    {s.startDate}–{s.endDate}
                  </option>
                ))}
              </select>
            </label>
            {["from", "to"].map((k) => (
              <label className="inc-field" key={k}>
                {k === "from" ? "From" : "To"}
                <input
                  type="date"
                  value={(filters as any)[k]}
                  onChange={(e) =>
                    setFilters({ ...filters, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="inc-field">
              Team
              <select
                value={filters.teamId}
                onChange={(e) =>
                  setFilters({ ...filters, teamId: e.target.value })
                }
              >
                <option value="">All teams</option>
                {data.teams.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inc-field">
              Category
              <select
                value={filters.categoryId}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    categoryId: e.target.value,
                    productId: "",
                  })
                }
              >
                <option value="">All categories</option>
                {data.categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inc-field">
              Product
              <select
                value={filters.productId}
                onChange={(e) =>
                  setFilters({ ...filters, productId: e.target.value })
                }
              >
                <option value="">All products</option>
                {data.products
                  .filter(
                    (p: any) =>
                      !filters.categoryId || p.parentId === filters.categoryId,
                  )
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="inc-field">
              Area
              <select
                value={filters.areaId}
                onChange={(e) =>
                  setFilters({ ...filters, areaId: e.target.value })
                }
              >
                <option value="">All areas</option>
                {data.areas.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading && <p role="status">Updating report…</p>}
          {!error && !loading && (
            <>
              <div
                className="inc-row"
                style={{ justifyContent: "end", marginBottom: 18 }}
              >
                {["xlsx", "pdf"].map((f) => (
                  <a
                    key={f}
                    className="inc-btn"
                    href={`/api/incubation/public/${token}?${query}&format=${f}`}
                  >
                    <Download size={15} />
                    {f === "xlsx" ? "Excel" : "PDF"}
                  </a>
                ))}
              </div>
              <div className="inc-kpis">
                {[
                  ["Net sales", "revenue"],
                  ["Operating expenses", "expenses"],
                  ["Net profit / loss", "netProfit"],
                  ["Stock value", "stockValue"],
                ].map(([title, key]) => (
                  <div className="inc-kpi" key={key}>
                    <label>{title}</label>
                    <strong>
                      {money(
                        data.totals?.[key] ??
                          data.summaries.reduce(
                            (n: number, s: any) => n + s[key],
                            0,
                          ),
                      )}
                    </strong>
                  </div>
                ))}
              </div>
              <section className="inc-card">
                <h2>Daily sales</h2>
                <div className="inc-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.trend}>
                      <CartesianGrid strokeDasharray="3 5" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        dataKey="revenue"
                        name="Sales (BDT)"
                        stroke="#248264"
                        fill="#dceddf"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
              {data.results && (
                <div style={{ marginTop: 18 }}>
                  <ResultsCard
                    published={{
                      snapshot: { asOf: data.results.asOf, ranking: data.results.ranking },
                      note: data.results.note,
                      publishedAt: data.results.publishedAt,
                    }}
                  />
                </div>
              )}
              <section className="inc-card" style={{ marginTop: 18 }}>
                <h2>Results by team</h2>
                <div className="inc-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Team",
                          "Net sales",
                          "Expenses",
                          "Gross profit",
                          "Net profit / loss",
                          "Stock",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.summaries.map((s: any) => (
                        <tr key={s.teamId}>
                          <td>
                            <b>{s.teamName}</b>
                          </td>
                          {[
                            "revenue",
                            "expenses",
                            "grossProfit",
                            "netProfit",
                            "stockValue",
                          ].map((k) => (
                            <td key={k}>{money(s[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <p
                className="inc-sub"
                style={{ textAlign: "center", marginTop: 20 }}
              >
                Generated:{" "}
                {new Date(data.generatedAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Dhaka",
                })}{" "}
                • All amounts in BDT
              </p>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}
