"use client";
import MonitorPanel from "./MonitorPanel";
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
        খুঁজুন
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="তারিখ, পণ্য বা জমার তথ্য"
        />
      </label>
      <label className="inc-field">
        সাজান
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">নতুন তারিখ আগে</option>
          <option value="oldest">পুরোনো তারিখ আগে</option>
        </select>
      </label>
      <span>{shown.length}টি রেসপন্স</span>
    </div>
  );
  const pagination = (
    <div className="inc-row" style={{ marginTop: 15 }}>
      <button
        className="inc-btn"
        disabled={currentPage === 1}
        onClick={() => setPage(currentPage - 1)}
      >
        আগের পৃষ্ঠা
      </button>
      <span>
        {currentPage} / {pages}
      </span>
      <button
        className="inc-btn"
        disabled={currentPage === pages}
        onClick={() => setPage(currentPage + 1)}
      >
        পরের পৃষ্ঠা
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
    ["sale", "বিক্রি এন্ট্রি", Wallet],
    ["purchase", "কেনা এন্ট্রি", ShoppingBag],
    ["expense", "খরচ এন্ট্রি", FileText],
    ["supplier_return", "সরবরাহকারীকে ফেরত", Package],
    ["transfer", "অন্য টিমে হস্তান্তর", Package],
    ["customer_refund", "ক্রেতার রিফান্ড", Wallet],
    ["damage", "নষ্ট পণ্য", Package],
    ["cash_count", "ক্যাশ গণনা", Wallet],
    ["repayment", "মূল ফান্ড ফেরত", Wallet],
  ];
  if (!b?.program)
    return (
      <main className="inc">
        <Link href="/student-dashboard/competitions">← Competitions</Link>
        <p role={error ? "alert" : "status"}>
          {error || "আপনার workspace লোড হচ্ছে…"}
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
          <span className="inc-role">{lead ? "টিম লিডার" : "টিম সদস্য"}</span>
        </div>
        <p className="inc-eyebrow" style={{ marginTop: 22 }}>
          BUSINESS INCUBATION · {b.state}
        </p>
        <h1>{lead ? "আমাদের টিম পরিচালনা" : "আমার কাজ"}</h1>
        <p>
          {b.program.name} · <b>{team?.name}</b>
        </p>
        <small>
          {b.actor.name} · লিডার:{" "}
          {team?.members?.find((m: R) => m.isLead)?.name || "নির্ধারিত নেই"}
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
          নতুন এন্ট্রি বন্ধ। আপনার পূর্বের তথ্য দেখা ও সংশোধন অনুরোধ করা যাবে।
        </p>
      )}
      <nav
        className="inc-tabs"
        aria-label={lead ? "লিডারের কাজ" : "সদস্যের কাজ"}
      >
        {[
          ["home", lead ? "আমাদের টিম" : "আজকের কাজ"],
          ...(lead ? [["finance", "বিক্রি ও হিসাব"]] : []),
          ["field", lead ? "মাঠ ও টিম" : "আমার মাঠের কাজ"],
          ["learning", "FGD ও Insights"],
          ["requests", "আমার অনুরোধ"],
          ["history", "জমার ইতিহাস"],
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
            শুরু
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="inc-field">
            শেষ
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
            <MonitorPanel issues={b.monitor} title="জরুরি — এখনই করুন" />
          )}
          <section className="inc-card">
            <h2>আজকের দায়িত্ব</h2>
            {lead && !stock.some((s: R) => s.available > 0) && (
              <p className="inc-notice">
                টিমের stock এখন খালি। বিক্রির আগে কেনা এন্ট্রি দিন।
              </p>
            )}
            <button className="inc-btn" onClick={() => setTab("requests")}>
              অনুরোধের অবস্থা দেখুন
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
                .join(" / ") || "আজকের স্প্রিন্ট নির্ধারিত নেই—শিক্ষককে জানান।"}
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
                {own ? "মাঠের কাজ শেষ করুন" : "মাঠে কাজ শুরু করুন"}
              </button>
              <button
                className="inc-task"
                disabled={!running}
                onClick={() => onRecord("fgd")}
              >
                <BookOpen />
                FGD জমা দিন
              </button>
              <button
                className="inc-task"
                disabled={!running}
                onClick={() => onRecord("insight")}
              >
                <Plus />
                Market Insight দিন
              </button>
            </div>
          </section>
          <h2 style={{ marginTop: 22 }}>আমাদের টিমের অবস্থা</h2>
          <div className="inc-kpis">
            {[
              ["নিট বিক্রি", summary.revenue],
              ["নিট লাভ / ক্ষতি", summary.netProfit],
              ["স্টকের মূল্য", summary.stockValue],
              ["হাতে থাকার হিসাব", summary.cash],
            ].map(([l, n]) => (
              <div className="inc-kpi" key={l}>
                <label>{l}</label>
                <strong>{money(Number(n))}</strong>
              </div>
            ))}
          </div>
          <section className="inc-card">
            <h2>টিমের সদস্য</h2>
            <div className="inc-row">
              {team?.members?.map((m: R) => (
                <span key={m.id} className="inc-status">
                  {m.name}
                  {m.isLead ? " · লিডার" : ""}
                </span>
              ))}
            </div>
            <p className="inc-sub" style={{ marginTop: 15 }}>
              অন্য টিমের ব্যক্তিগত হিসাব এখানে দেখা যায় না। নিজের দায়িত্ব
              অনুযায়ী কাজগুলো সামনে দেওয়া আছে।
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
            <h2>নিজের টিমের রেসপন্স</h2>
            <p>নিজের টিমের পূর্ণ রিপোর্ট:</p>
            {exports("")}
            <div className="inc-toolbar">
              {[
                ...actions.map(([k, l]) => [k, l]),
                ["fund", "প্রাপ্ত ফান্ড"],
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
                    <th>তারিখ</th>
                    <th>পণ্য / তথ্য</th>
                    <th>অবস্থা</th>
                    <th>কাজ</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r: R) => (
                    <tr key={r.id}>
                      <td>
                        {r.date}
                        <small className="inc-sub" style={{ display: "block" }}>
                          জমা: {time(r.createdAt)}
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
                              " · পাওয়া " +
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
                            · ভাউচার
                          </a>
                        )}
                      </td>
                      <td>{r.status}</td>
                      <td>
                        {canCorrect(r) && (
                          <button className="inc-btn" onClick={() => onEdit(r)}>
                            সংশোধন অনুরোধ
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length === 0 && (
              <p className="inc-notice">এই ফিল্টারে কোনো রেসপন্স নেই।</p>
            )}
            {pagination}
          </section>
          <section className="inc-card" style={{ marginTop: 20 }}>
            <h2>পণ্য ও উপলব্ধ stock</h2>
            <div className="inc-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>পণ্য / variant</th>
                    <th>মোট / হস্তান্তরের অপেক্ষায় / উপলব্ধ</th>
                    <th>মূল্য</th>
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
            <h2>{own ? "আপনার মাঠ সেশন চলছে" : "মাঠে কাজ শুরু করুন"}</h2>
            <p className="inc-sub">
              ওয়েব পেজ সামনে থাকলে GPS update পাঠায়। ফোন লক অবস্থার tracking-এর
              Android অ্যাপ পরে যুক্ত হবে।
            </p>
            <label className="inc-field">
              কাজের ব্রড এরিয়া
              <select
                aria-label="কাজের ব্রড এরিয়া"
                value={f.areaId}
                onChange={(e) => setF({ ...f, areaId: e.target.value })}
              >
                <option value="">বাছুন</option>
                {areas.map((a: R) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {!own && (
              <>
                <h3>সঙ্গে নেওয়া পণ্য</h3>
                {(f.carried || []).map((l: R, i: number) => (
                  <div key={i} className="inc-row">
                    <select
                      aria-label="সঙ্গে নেওয়া পণ্য"
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
                      <option value="">পণ্য বাছুন</option>
                      {stock
                        .filter((s: R) => s.quantity > 0)
                        .map((s: R) => (
                          <option key={s.productId} value={s.productId}>
                            {name(s.productId)} · {s.quantity / 1000}
                          </option>
                        ))}
                    </select>
                    <input
                      aria-label="বহনের পরিমাণ"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={l.quantity}
                      onChange={(e) =>
                        setF({
                          ...f,
                          carried: f.carried.map((x: R, j: number) =>
                            i === j ? { ...x, quantity: e.target.value } : x,
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
                      সরান
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
                  + পণ্য
                </button>
              </>
            )}
            {own && (
              <div className="inc-form-grid">
                <label className="inc-field">
                  হাঁটার স্টেপ
                  <input
                    aria-label="হাঁটার স্টেপ"
                    type="number"
                    min="0"
                    value={f.steps}
                    onChange={(e) => setF({ ...f, steps: e.target.value })}
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
                ? "GPS যাচাই হচ্ছে…"
                : own
                  ? "Check-out করুন"
                  : "GPS দিয়ে Check-in করুন"}
            </button>
          </section>
          <section className="inc-card" style={{ marginTop: 20 }}>
            <h2>{lead ? "টিমের মাঠের কাজ" : "আমার মাঠের ইতিহাস"}</h2>
            {exports("field")}
            <div className="inc-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>সদস্য</th>
                    <th>শুরু / শেষ</th>
                    <th>স্টেপ</th>
                    <th>প্রমাণ / GPS</th>
                  </tr>
                </thead>
                <tbody>
                  {b.fields.map((s: R) => (
                    <tr key={s.id}>
                      <td>{s.userName}</td>
                      <td>
                        {time(s.checkIn)}
                        <br />
                        {s.checkOut ? time(s.checkOut) : "মাঠে আছেন"}
                      </td>
                      <td>
                        {s.steps}
                        <small style={{ display: "block" }}>
                          সঙ্গে:{" "}
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
                          GPS ইতিহাস
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
                  বন্ধ
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
                      মানচিত্রে দেখুন
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
              FGD জমা দিন
            </button>
            <button
              className="inc-btn"
              disabled={!running}
              onClick={() => onRecord("insight")}
            >
              Market Insight দিন
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
                      <p>আপত্তি: {r.data.objections}</p>
                      <p>কেন কিনেছে: {r.data.whyBought || "—"}</p>
                      <p>এলাকা: {r.data.bestArea}</p>
                    </>
                  )}
                  {canCorrect(r) && (
                    <button className="inc-btn" onClick={() => onEdit(r)}>
                      সংশোধন অনুরোধ
                    </button>
                  )}
                </article>
              ))}
          </div>
        </>
      )}
      {tab === "requests" && (
        <section className="inc-card">
          <h2>অনুরোধ ও অনুমোদনের অবস্থা</h2>
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
                    পণ্য গ্রহণের প্রস্তাব:{" "}
                    {r.data.lines
                      ?.map((l: R) => name(l.productId) + " × " + l.quantity)
                      .join(", ")}
                  </p>
                  <button
                    className="inc-btn primary"
                    onClick={() => onAccept(r)}
                  >
                    ভাউচারসহ গ্রহণ / প্রত্যাখ্যান
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
          <h2>{lead ? "টিমের জমার ইতিহাস" : "আমার জমার ইতিহাস"}</h2>
          <div className="inc-form-grid">
            <label className="inc-field">
              শুরু
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="inc-field">
              শেষ
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
                {r.enteredByName} · জমা: {time(r.createdAt)} · {r.status}
              </p>
              {canCorrect(r) && (
                <button className="inc-btn" onClick={() => onEdit(r)}>
                  সংশোধন অনুরোধ
                </button>
              )}
            </div>
          ))}
          {shown.length === 0 && (
            <p className="inc-notice">এই ফিল্টারে কোনো রেসপন্স নেই।</p>
          )}
          {pagination}
        </section>
      )}
      {children}
    </main>
  );
}
