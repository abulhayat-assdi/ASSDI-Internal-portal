"use client";
import { numericOnly } from "./numeric";
import MonitorPanel from "./MonitorPanel";
import ResultsCard from "./ResultsCard";
import { STATUS_LABELS } from "@/lib/incubation/lifecycle";
import NotificationBell from "./NotificationBell";
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Wallet,
  MapPin,
  Plus,
  BookOpen,
  ArrowLeft,
  Package,
  FileText,
} from "lucide-react";
import {
  KIND_LABELS,
  todayDhaka,
  type RecordKind,
} from "@/lib/incubation/domain";
import { FieldCorrectionEditor } from "./FieldCorrections";
type R = Record<string, any>;
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "BDT" }).format(
    (n || 0) / 100,
  );
const time = (v: string) =>
  new Date(v).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
export default function StudentWorkspace({
  bundle: b,
  error,
  message,
  busy,
  refresh,
  onRecord,
  onEdit,
  onAccept,
  onField,
  fieldForm: f,
  setFieldForm: setF,
  onUpload,
  onError,
  children,
}: {
  bundle: any;
  error: string;
  message: string;
  busy: boolean;
  refresh: () => void;
  onRecord: (k: RecordKind) => void;
  onEdit: (r: R) => void;
  onAccept: (r: R) => void;
  onField: (k: string) => void;
  fieldForm: R;
  setFieldForm: (f: R) => void;
  onUpload: (file: File, teamId: string) => Promise<R>;
  onError: (s: string) => void;
  children: ReactNode;
}) {
  const [tab, setTab] = useState("home"),
    [sheet, setSheet] = useState("sale"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [positions, setPositions] = useState<R[]>([]);
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1);
  useEffect(() => setPage(1), [tab, sheet, from, to, search, sort]);
  const lead = !!b?.member?.isLead,
    team = b?.teams?.[0],
    own = b?.fields?.find((s: R) => s.userId === b.actor.id && !s.checkOut),
    running = b?.state === "running";
  const summary = b?.ledger?.summaries?.[0] || {},
    products = b?.catalog?.filter((c: R) => c.kind === "product") || [],
    areas = b?.catalog?.filter((c: R) => c.kind === "area") || [];
  const stock = Object.entries(b?.ledger?.stocks || {}).map(
    ([key, s]: [string, any]) => ({
      ...s,
      productId: key.split("|")[1],
      reserved: b?.ledger?.reserved?.[key] || 0,
      available: s.quantity - (b?.ledger?.reserved?.[key] || 0),
    }),
  );
  const name = (id: string) => {
    const p = products.find((p: R) => p.id === id);
    return p ? [p.name, p.variant].filter(Boolean).join(" · ") : id;
  };
  const canCorrect = (r: R) =>
    r.status === "posted" &&
    r.teamId === b.member.teamId &&
    (["fgd", "insight"].includes(r.kind)
      ? r.enteredBy === b.actor.id
      : lead && r.kind !== "fund");
  const records = (b?.records || []).filter(
    (r: R) => (!from || r.date >= from) && (!to || r.date <= to),
  );
  const shown = records
    .filter(
      (r: R) =>
        (tab !== "finance" || r.kind === sheet) &&
        (!search ||
          [
            r.date,
            r.enteredByName,
            r.status,
            KIND_LABELS[r.kind as RecordKind],
            JSON.stringify(r.data),
            ...(r.data.lines || []).map((l: R) => name(l.productId)),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase())),
    )
    .sort((a: R, z: R) =>
      sort === "oldest"
        ? a.date.localeCompare(z.date) || a.createdAt.localeCompare(z.createdAt)
        : z.date.localeCompare(a.date) ||
          z.createdAt.localeCompare(a.createdAt),
    );
  const pages = Math.max(1, Math.ceil(shown.length / 20)),
    currentPage = Math.min(page, pages),
    paged = shown.slice((currentPage - 1) * 20, currentPage * 20);
  const sheetControls = (
    <div className="inc-toolbar">
      <label className="inc-field">
        Search
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Date, product or details"
        />
      </label>
      <label className="inc-field">
        Sort
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>
      <span>{shown.length} entries</span>
    </div>
  );
  const pagination = (
    <div className="inc-row" style={{ marginTop: 15 }}>
      <button
        className="inc-btn"
        disabled={currentPage === 1}
        onClick={() => setPage(currentPage - 1)}
      >
        Previous page
      </button>
      <span>
        {currentPage} / {pages}
      </span>
      <button
        className="inc-btn"
        disabled={currentPage === pages}
        onClick={() => setPage(currentPage + 1)}
      >
        Next page
      </button>
    </div>
  );
  const download = async (format: string, scope: string) => {
    try {
      const q = new URLSearchParams({
        programId: b.program.id,
        format,
        sheet: scope,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      const r = await fetch("/api/incubation/export?" + q);
      if (!r.ok) throw Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "My_Competition_" + scope + "." + format;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      onError((e as Error).message);
    }
  };
  const exports = (scope: string) => (
    <div className="inc-row">
      {["xlsx", "pdf"].map((k) => (
        <button key={k} className="inc-btn" onClick={() => download(k, scope)}>
          {k === "xlsx" ? "Excel" : "PDF"}
        </button>
      ))}
    </div>
  );
  const actions: [RecordKind, string, any][] = [
    ["sale", "Add sale", Wallet],
    ["purchase", "Add purchase", ShoppingBag],
    ["expense", "Add expense", FileText],
    ["supplier_return", "Supplier return", Package],
    ["transfer", "Transfer to team", Package],
    ["customer_refund", "Customer refund", Wallet],
    ["damage", "Damage", Package],
    ["cash_count", "Cash count", Wallet],
    ["repayment", "Principal repayment", Wallet],
  ];
  if (!b?.program)
    return (
      <main className="inc">
        <Link href="/student-dashboard/competitions">← Competitions</Link>
        <p role={error ? "alert" : "status"}>
          {error || "Loading your workspace…"}
        </p>
      </main>
    );
  return (
    <main className={"inc inc-student " + (lead ? "inc-leader" : "inc-member")}>
      <header className="inc-head">
        <div className="inc-row inc-between">
          <Link className="inc-btn" href="/student-dashboard/competitions">
            <ArrowLeft size={15} />
            Competitions
          </Link>
          <button className="inc-btn" onClick={refresh}>
            Refresh
          </button>
          <NotificationBell programId={b.program.id} />
          <span className="inc-role">{lead ? "Team lead" : "Member"}</span>
        </div>
        <p className="inc-eyebrow" style={{ marginTop: 22 }}>
          BUSINESS INCUBATION · {STATUS_LABELS[b.state] || b.state}
        </p>
        <h1>{lead ? "Manage our team" : "My work"}</h1>
        <p>
          {b.program.name} · <b>{team?.name}</b>
        </p>
        <small>
          {b.actor.name} · Team lead:{" "}
          {team?.members?.find((m: R) => m.isLead)?.name || "Not assigned"}
        </small>
      </header>
      {error && (
        <p role="alert" className="inc-notice inc-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="inc-notice">
          {message}
        </p>
      )}
      {!running && (
        <p className="inc-notice">
          New entries are closed. You can still view your past entries and request corrections.
        </p>
      )}
      <nav
        className="inc-tabs"
        aria-label={lead ? "Team lead tasks" : "Member tasks"}
      >
        {[
          ["home", lead ? "Our team" : "Today"],
          ...(lead ? [["finance", "Sales & accounts"]] : []),
          ["field", lead ? "Field & team" : "My field work"],
          ["learning", "FGD & insights"],
          ["requests", "My requests"],
          ["history", "History"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </nav>
      {["finance", "learning"].includes(tab) && (
        <div className="inc-form-grid">
          <label className="inc-field">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="inc-field">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {tab === "home" && (
        <>
          {(b.monitor?.length ?? 0) > 0 && (
            <MonitorPanel issues={b.monitor} title="Needs attention now" />
          )}
          {b.results && (
            <ResultsCard published={b.results} highlightTeamId={b.member?.teamId} />
          )}
          <section className="inc-card">
            <h2>Today's tasks</h2>
            {lead && !stock.some((s: R) => s.available > 0) && (
              <p className="inc-notice">
                Your team has no stock. Add a purchase before recording sales.
              </p>
            )}
            <button className="inc-btn" onClick={() => setTab("requests")}>
              View request status
            </button>
            <p>
              {b.sprints
                ?.filter(
                  (s: R) =>
                    s.startDate <= todayDhaka() && s.endDate >= todayDhaka(),
                )
                .map(
                  (s: R) =>
                    b.catalog.find((c: R) => c.id === s.categoryId)?.name +
                    " · " +
                    s.startDate +
                    "–" +
                    s.endDate,
                )
                .join(" / ") || "No sprint is set for today — tell your teacher."}
            </p>
            <div className="inc-task-grid">
              {lead &&
                actions.slice(0, 4).map(([k, l, Icon]) => (
                  <button
                    className="inc-task"
                    key={k}
                    disabled={!running}
                    onClick={() => onRecord(k)}
                  >
                    <Icon />
                    {l}
                  </button>
                ))}
              <button className="inc-task" onClick={() => setTab("field")}>
                <MapPin />
                {own ? "Finish field work" : "Start field work"}
              </button>
              <button
                className="inc-task"
                disabled={!running}
                onClick={() => onRecord("fgd")}
              >
                <BookOpen />
                Submit FGD
              </button>
              <button
                className="inc-task"
                disabled={!running}
                onClick={() => onRecord("insight")}
              >
                <Plus />
                Add market insight
              </button>
            </div>
          </section>
          <h2 style={{ marginTop: 22 }}>Our team at a glance</h2>
          <div className="inc-kpis">
            {[
              ["Net sales", summary.revenue],
              ["Net profit / loss", summary.netProfit],
              ["Stock value", summary.stockValue],
              ["Cash in hand", summary.cash],
            ].map(([l, n]) => (
              <div className="inc-kpi" key={l}>
                <label>{l}</label>
                <strong>{money(Number(n))}</strong>
              </div>
            ))}
          </div>
          <section className="inc-card">
            <h2>Team members</h2>
            <div className="inc-row">
              {team?.members?.map((m: R) => (
                <span key={m.id} className="inc-status">
                  {m.name}
                  {m.isLead ? " · Team lead" : ""}
                </span>
              ))}
            </div>
            <p className="inc-sub" style={{ marginTop: 15 }}>
              Other teams' private accounts are not shown here. Your tasks are
              listed above based on your role.
            </p>
          </section>
        </>
      )}
      {tab === "finance" && lead && (
        <>
          <div className="inc-task-grid">
            {actions.map(([k, l, Icon]) => (
              <button
                className="inc-task"
                key={k}
                disabled={!running}
                onClick={() => onRecord(k)}
              >
                <Icon size={19} />
                {l}
              </button>
            ))}
          </div>
          <section className="inc-card" style={{ marginTop: 20 }}>
            <h2>Our team's entries</h2>
            <p>Full report for our team:</p>
            {exports("")}
            <div className="inc-toolbar">
              {[
                ...actions.map(([k, l]) => [k, l]),
                ["fund", "Funding received"],
              ].map(([k, l]) => (
                <button
                  className={"inc-btn " + (sheet === k ? "primary" : "")}
                  key={k}
                  onClick={() => setSheet(k)}
                >
                  {l}
                </button>
              ))}
            </div>
            {exports(sheet)}
            {sheetControls}
            <div className="inc-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product / details</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r: R) => (
                    <tr key={r.id}>
                      <td>
                        {r.date}
                        <small className="inc-sub" style={{ display: "block" }}>
                          Submitted: {time(r.createdAt)}
                        </small>
                      </td>
                      <td>
                        {r.data.lines
                          ?.map(
                            (l: R) =>
                              name(l.productId) +
                              " × " +
                              l.quantity +
                              " @ " +
                              money(Number(l.unitPrice || 0) * 100) +
                              " · received " +
                              money(
                                Number(
                                  l.cash ??
                                    Number(l.quantity) *
                                      Number(l.unitPrice || 0),
                                ) * 100,
                              ),
                          )
                          .join(", ") ||
                          (r.data.amount
                            ? money(Number(r.data.amount) * 100)
                            : r.data.note)}
                        {r.data.session && <small> · {r.data.session}</small>}
                        {r.data.round && <small> · {r.data.round}</small>}
                        {r.data.voucherId && (
                          <a
                            href={"/api/incubation/files/" + r.data.voucherId}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {" "}
                            · Voucher
                          </a>
                        )}
                      </td>
                      <td>{r.status}</td>
                      <td>
                        {canCorrect(r) && (
                          <button className="inc-btn" onClick={() => onEdit(r)}>
                            Correction request
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length === 0 && (
              <p className="inc-notice">No entries match this filter.</p>
            )}
            {pagination}
          </section>
          <section className="inc-card" style={{ marginTop: 20 }}>
            <h2>Products and available stock</h2>
            <div className="inc-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product / variant</th>
                    <th>Total / reserved for transfer / available</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s: R) => (
                    <tr key={s.productId}>
                      <td>{name(s.productId)}</td>
                      <td>
                        {s.quantity / 1000} / {s.reserved / 1000} /{" "}
                        <b>{s.available / 1000}</b>
                      </td>
                      <td>{money(s.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === "field" && (
        <>
          <section className="inc-card">
            <h2>{own ? "Your field session is running" : "Start field work"}</h2>
            <p className="inc-sub">
              GPS updates are sent while this page is open. Tracking with the phone locked
              will come with the Android app later.
            </p>
            <label className="inc-field">
              Work area
              <select
                aria-label="Work area"
                value={f.areaId}
                onChange={(e) => setF({ ...f, areaId: e.target.value })}
              >
                <option value="">Select</option>
                {areas.map((a: R) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {!own && (
              <>
                <h3>Products carried</h3>
                {(f.carried || []).map((l: R, i: number) => (
                  <div key={i} className="inc-row">
                    <select
                      aria-label="Products carried"
                      value={l.productId}
                      onChange={(e) =>
                        setF({
                          ...f,
                          carried: f.carried.map((x: R, j: number) =>
                            i === j ? { ...x, productId: e.target.value } : x,
                          ),
                        })
                      }
                    >
                      <option value="">Select product</option>
                      {stock
                        .filter((s: R) => s.quantity > 0)
                        .map((s: R) => (
                          <option key={s.productId} value={s.productId}>
                            {name(s.productId)} · {s.quantity / 1000}
                          </option>
                        ))}
                    </select>
                    <input
                      aria-label="Quantity carried"
                      type="text"
                      inputMode="decimal"
                      min="0.001"
                      step="0.001"
                      value={l.quantity}
                      onChange={(e) =>
                        setF({
                          ...f,
                          carried: f.carried.map((x: R, j: number) =>
                            i === j ? { ...x, quantity: numericOnly(e.target.value, true) } : x,
                          ),
                        })
                      }
                    />
                    <button
                      className="inc-btn"
                      onClick={() =>
                        setF({
                          ...f,
                          carried: f.carried.filter(
                            (_: R, j: number) => j !== i,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="inc-btn"
                  onClick={() =>
                    setF({
                      ...f,
                      carried: [
                        ...(f.carried || []),
                        { productId: "", quantity: "1" },
                      ],
                    })
                  }
                >
                  + Product
                </button>
              </>
            )}
            {own && (
              <div className="inc-form-grid">
                <label className="inc-field">
                  Steps walked
                  <input
                    aria-label="Steps walked"
                    type="text"
                    inputMode="numeric"
                    min="0"
                    value={f.steps}
                    onChange={(e) => setF({ ...f, steps: numericOnly(e.target.value, false) })}
                  />
                </label>
                <label className="inc-field">
                  Pedometer proof
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      try {
                        const file = e.target.files?.[0];
                        if (file) {
                          const a = await onUpload(file, b.member.teamId);
                          setF({ ...f, proofId: a.id });
                        }
                      } catch (e) {
                        onError((e as Error).message);
                      }
                    }}
                  />
                </label>
              </div>
            )}
            <button
              className="inc-btn primary"
              disabled={busy || !f.areaId || (!own && !running)}
              onClick={() => onField(own ? "checkout" : "checkin")}
            >
              {busy
                ? "Checking GPS…"
                : own
                  ? "Check out"
                  : "Check in with GPS"}
            </button>
          </section>
          <section className="inc-card" style={{ marginTop: 20 }}>
            <h2>{lead ? "Team field work" : "My field history"}</h2>
            {exports("field")}
            <div className="inc-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Start / end</th>
                    <th>Steps</th>
                    <th>Proof / GPS</th>
                  </tr>
                </thead>
                <tbody>
                  {b.fields.map((s: R) => (
                    <tr key={s.id}>
                      <td>{s.userName}</td>
                      <td>
                        {time(s.checkIn)}
                        <br />
                        {s.checkOut ? time(s.checkOut) : "In the field"}
                      </td>
                      <td>
                        {s.steps}
                        <small style={{ display: "block" }}>
                          Carried:{" "}
                          {(s.carried || [])
                            .map(
                              (l: R) => name(l.productId) + " × " + l.quantity,
                            )
                            .join(", ") || "—"}
                        </small>
                      </td>
                      <td>
                        {s.proofId && (
                          <a
                            className="inc-btn"
                            href={"/api/incubation/files/" + s.proofId}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Proof
                          </a>
                        )}
                        <button
                          className="inc-btn"
                          onClick={async () => {
                            try {
                              const r = await fetch(
                                  "/api/incubation/field?programId=" +
                                    b.program.id +
                                    "&sessionId=" +
                                    s.id,
                                ),
                                d = await r.json();
                              if (!r.ok) throw Error(d.error);
                              setPositions(d.positions);
                            } catch (e) {
                              onError((e as Error).message);
                            }
                          }}
                        >
                          GPS history
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {positions.length > 0 && (
              <div className="inc-old">
                <button className="inc-btn" onClick={() => setPositions([])}>
                  Close
                </button>
                {positions.map((p: R) => (
                  <p key={p.id}>
                    {time(p.capturedAt)} · accuracy {p.accuracy}m ·{" "}
                    <a
                      href={
                        "https://www.google.com/maps?q=" +
                        p.latitude +
                        "," +
                        p.longitude
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on map
                    </a>
                  </p>
                ))}
              </div>
            )}
          </section>
          <FieldCorrectionEditor
            bundle={b}
            onSaved={refresh}
            onError={onError}
          />
        </>
      )}
      {tab === "learning" && (
        <>
          <div className="inc-row">
            <button
              className="inc-btn primary"
              disabled={!running}
              onClick={() => onRecord("fgd")}
            >
              Submit FGD
            </button>
            <button
              className="inc-btn"
              disabled={!running}
              onClick={() => onRecord("insight")}
            >
              Add market insight
            </button>
            {exports("learning")}
          </div>
          <div className="inc-grid" style={{ marginTop: 20 }}>
            {records
              .filter((r: R) => ["fgd", "insight"].includes(r.kind))
              .map((r: R) => (
                <article key={r.id} className="inc-card">
                  <h2>{r.kind === "fgd" ? "FGD" : "Market Insight"}</h2>
                  <p className="inc-sub">
                    {r.enteredByName} · {r.date}
                  </p>
                  {r.kind === "fgd" ? (
                    <>
                      <h3>Findings</h3>
                      {r.data.findings
                        ?.filter(Boolean)
                        .map((s: string, i: number) => (
                          <p key={i}>
                            {i + 1}. {s}
                          </p>
                        ))}
                      <h3>Next actions</h3>
                      {r.data.actions
                        ?.filter(Boolean)
                        .map((s: string, i: number) => (
                          <p key={i}>
                            {i + 1}. {s}
                          </p>
                        ))}
                    </>
                  ) : (
                    <>
                      <p>Segment: {r.data.segment}</p>
                      <p>Objections: {r.data.objections}</p>
                      <p>Why they bought: {r.data.whyBought || "—"}</p>
                      <p>Area: {r.data.bestArea}</p>
                    </>
                  )}
                  {canCorrect(r) && (
                    <button className="inc-btn" onClick={() => onEdit(r)}>
                      Correction request
                    </button>
                  )}
                </article>
              ))}
          </div>
        </>
      )}
      {tab === "requests" && (
        <section className="inc-card">
          <h2>Requests and approvals</h2>
          {lead &&
            b.records
              .filter(
                (r: R) =>
                  r.status === "transfer_pending" &&
                  r.targetTeamId === b.member.teamId,
              )
              .map((r: R) => (
                <div className="inc-old" key={r.id}>
                  <p>
                    Products offered to you:{" "}
                    {r.data.lines
                      ?.map((l: R) => name(l.productId) + " × " + l.quantity)
                      .join(", ")}
                  </p>
                  <button
                    className="inc-btn primary"
                    onClick={() => onAccept(r)}
                  >
                    Accept with voucher / reject
                  </button>
                </div>
              ))}
          {b.records
            .filter((r: R) =>
              ["pending", "transfer_pending"].includes(r.status),
            )
            .map((r: R) => (
              <p key={r.id}>
                {KIND_LABELS[r.kind as RecordKind]} · {r.date} · {r.status}
              </p>
            ))}
          {[...b.corrections, ...b.fieldCorrections].map((r: R) => (
            <div className="inc-old" key={r.id}>
              <b>{r.status}</b>
              <p>{r.reason}</p>
              <small>{r.reviewNote}</small>
            </div>
          ))}
        </section>
      )}
      {tab === "history" && (
        <section className="inc-card">
          <h2>{lead ? "Team submission history" : "My submission history"}</h2>
          <div className="inc-form-grid">
            <label className="inc-field">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="inc-field">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
          {sheetControls}
          {paged.map((r: R) => (
            <div className="inc-old" key={r.id}>
              <b>
                {KIND_LABELS[r.kind as RecordKind]} · {r.date}
              </b>
              <p>
                {r.enteredByName} · Submitted: {time(r.createdAt)} · {r.status}
              </p>
              {canCorrect(r) && (
                <button className="inc-btn" onClick={() => onEdit(r)}>
                  Correction request
                </button>
              )}
            </div>
          ))}
          {shown.length === 0 && (
            <p className="inc-notice">No entries match this filter.</p>
          )}
          {pagination}
        </section>
      )}
      {children}
    </main>
  );
}
