"use client";
/**
 * Full-screen spreadsheet for Business Incubation data, in the style of the
 * form competition "Manage Responses" grid: team-wise sheets (one per record
 * type) and individual sheets (FGD, market insights). Staff edit cells, add
 * rows, delete rows and save everything in one atomic `sheet_save` call — if
 * any row is invalid nothing is saved and the row is highlighted.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, Trash2, X } from "lucide-react";
import { numericOnly } from "./numeric";
import "./incubation-glass.css";

type Row = Record<string, any>;
type CellType = "text" | "number" | "date" | "select" | "readonly";
interface Column {
  key: string;
  label: string;
  type: CellType;
  width?: number;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Record-level fields are shared by every line of a multi-line record. */
  recordLevel?: boolean;
}
interface SheetRow {
  key: string;
  recordId?: string;
  version?: number;
  lineIndex: number | null;
  enteredByName?: string;
  [field: string]: any;
}

const TEAM_KINDS = [
  ["sale", "Sales"],
  ["purchase", "Purchases"],
  ["expense", "Expenses"],
  ["supplier_return", "Supplier returns"],
  ["damage", "Damage"],
  ["customer_refund", "Customer refunds"],
  ["transfer", "Transfers"],
  ["fund", "Funding"],
  ["repayment", "Principal repayments"],
  ["cash_count", "Cash counts"],
] as const;
const INDIVIDUAL_KINDS = [
  ["fgd", "FGD"],
  ["insight", "Market insights"],
] as const;
const LINE_KINDS = ["sale", "purchase", "supplier_return", "damage", "customer_refund", "transfer"];
const AMOUNT_KINDS = ["expense", "fund", "repayment", "cash_count"];
/** Purchases need a voucher upload; refunds and transfers link to other records — use the entry forms for those. */
const CREATABLE = ["sale", "expense", "supplier_return", "damage", "fund", "repayment", "cash_count", "fgd", "insight"];
const NEEDS_REASON = ["supplier_return", "damage", "customer_refund", "transfer"];

const USER_FIELDS = ["productId", "quantity", "unitPrice", "cash", "amount", "expenseType", "round", "note", "reason", "f1", "a1", "segment", "objections", "whyBought", "bestArea"];
let seed = 0;
const newKey = () => `n${++seed}`;
const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v as Row)
          .filter((k) => (v as Row)[k] !== undefined)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable((v as Row)[k])}`)
          .join(",")}}`
      : JSON.stringify(v ?? null);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

export default function DataSheetManager({
  bundle,
  onClose,
  onSave,
}: {
  bundle: Row;
  onClose: () => void;
  onSave: (payload: Row) => Promise<Row>;
}) {
  const settings = bundle.program?.settings || {};
  const teams: Row[] = bundle.teams || [];
  const catalog: Row[] = bundle.catalog || [];
  const products = catalog.filter((c) => c.kind === "product");
  const areas = catalog.filter((c) => c.kind === "area");
  const [group, setGroup] = useState<"team" | "individual">("team");
  const [kind, setKind] = useState<string>("sale");
  const [rows, setRows] = useState<Record<string, SheetRow[]>>({});
  const [voids, setVoids] = useState<Row[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const originals = useMemo(
    () => new Map<string, Row>((bundle.records || []).map((r: Row) => [r.id, r])),
    [bundle.records],
  );

  const columns = useCallback(
    (k: string): Column[] => {
      const teamCol: Column = {
        key: "teamId",
        label: "Team",
        type: "select",
        width: 150,
        required: true,
        recordLevel: true,
        options: teams.map((t) => ({ value: t.id, label: t.name })),
      };
      const dateCol: Column = { key: "date", label: "Date", type: "date", width: 150, required: true, recordLevel: true };
      const noteCol: Column = { key: "note", label: "Note", type: "text", width: 220, recordLevel: true };
      const reasonCol: Column = {
        key: "reason",
        label: NEEDS_REASON.includes(k) ? "Reason" : "Reason (if cash differs)",
        type: "text",
        width: 220,
        required: NEEDS_REASON.includes(k),
        recordLevel: true,
      };
      if (LINE_KINDS.includes(k))
        return [
          teamCol,
          dateCol,
          {
            key: "productId",
            label: "Product",
            type: "select",
            width: 200,
            required: true,
            options: products.map((p) => ({ value: p.id, label: [p.name, p.variant].filter(Boolean).join(" · ") })),
          },
          { key: "quantity", label: "Quantity", type: "number", width: 110, required: true },
          ...(k === "damage" ? [] : [{ key: "unitPrice", label: "Unit price (BDT)", type: "number" as const, width: 130, required: true }]),
          ...(k === "sale"
            ? [
                { key: "cash", label: "Cash received (BDT)", type: "number" as const, width: 150 },
                {
                  key: "areaId",
                  label: "Area",
                  type: "select" as const,
                  width: 160,
                  required: true,
                  recordLevel: true,
                  options: areas.map((a) => ({ value: a.id, label: a.name })),
                },
                ...((settings.sessions || []).length
                  ? [
                      {
                        key: "session",
                        label: "Session",
                        type: "select" as const,
                        width: 140,
                        required: !!settings.sessionsRequired,
                        recordLevel: true,
                        options: settings.sessions.map((s: string) => ({ value: s, label: s })),
                      },
                    ]
                  : []),
              ]
            : []),
          { key: "total", label: "Total (BDT)", type: "readonly", width: 120 },
          ...(k === "sale" || NEEDS_REASON.includes(k) ? [reasonCol] : []),
          noteCol,
        ];
      if (AMOUNT_KINDS.includes(k))
        return [
          teamCol,
          dateCol,
          { key: "amount", label: k === "cash_count" ? "Counted cash (BDT)" : "Amount (BDT)", type: "number", width: 150, required: true, recordLevel: true },
          ...(k === "expense"
            ? [
                {
                  key: "expenseType",
                  label: "Expense type",
                  type: "select" as const,
                  width: 170,
                  required: true,
                  recordLevel: true,
                  options: (settings.expenseTypes || []).map((t: string) => ({ value: t, label: t })),
                },
              ]
            : []),
          ...(k === "fund" ? [{ key: "round", label: "Round / reference", type: "text" as const, width: 160, recordLevel: true }] : []),
          noteCol,
        ];
      if (k === "fgd")
        return [
          teamCol,
          dateCol,
          ...[1, 2, 3].map((i) => ({ key: `f${i}`, label: `Finding ${i}`, type: "text" as const, width: 220, recordLevel: true, required: i <= (settings.fgdRequiredCount || 1) })),
          ...[1, 2, 3].map((i) => ({ key: `a${i}`, label: `Action ${i}`, type: "text" as const, width: 220, recordLevel: true, required: i <= (settings.fgdRequiredCount || 1) })),
        ];
      return [
        teamCol,
        dateCol,
        (settings.segments || []).length
          ? { key: "segment", label: "Customer segment", type: "select", width: 180, required: true, recordLevel: true, options: settings.segments.map((s: string) => ({ value: s, label: s })) }
          : { key: "segment", label: "Customer segment", type: "text", width: 180, required: true, recordLevel: true },
        { key: "objections", label: "Top objections", type: "text", width: 220, required: true, recordLevel: true },
        { key: "whyBought", label: "Why they bought", type: "text", width: 220, required: !!settings.whyBoughtRequired, recordLevel: true },
        { key: "bestArea", label: "Best area", type: "text", width: 160, required: true, recordLevel: true },
      ];
    },
    [teams, products, areas, settings],
  );

  // Load posted records into sheet rows, one row per product line.
  useEffect(() => {
    const out: Record<string, SheetRow[]> = {};
    for (const r of bundle.records || []) {
      if (r.status !== "posted") continue;
      const d = r.data || {};
      const base: SheetRow = {
        key: `${r.id}`,
        recordId: r.id,
        version: r.version,
        lineIndex: null,
        enteredByName: r.enteredByName,
        teamId: r.teamId,
        date: r.date,
        note: d.note || "",
        reason: d.reason || "",
        areaId: d.areaId || "",
        session: d.session || "",
        amount: d.amount || "",
        expenseType: d.expenseType || "",
        round: d.round || "",
        segment: d.segment || "",
        objections: d.objections || "",
        whyBought: d.whyBought || "",
        bestArea: d.bestArea || "",
        ...Object.fromEntries([0, 1, 2].flatMap((i) => [[`f${i + 1}`, d.findings?.[i] || ""], [`a${i + 1}`, d.actions?.[i] || ""]])),
      };
      const list = (out[r.kind] ||= []);
      if (LINE_KINDS.includes(r.kind) && d.lines?.length)
        d.lines.forEach((l: Row, i: number) =>
          list.push({ ...base, key: `${r.id}:${i}`, lineIndex: i, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice ?? "", cash: l.cash ?? "" }),
        );
      else list.push(base);
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    setRows(out);
    setVoids([]);
    setErrors({});
  }, [bundle.records]);

  const cols = columns(kind);
  const current = rows[kind] || [];
  const isNew = (r: SheetRow) => !r.recordId;

  const setCell = (rowKey: string, col: Column, raw: string) => {
    const value = col.type === "number" ? numericOnly(raw) : raw;
    setErrors((e) => {
      if (!e[rowKey]) return e;
      const n = { ...e };
      delete n[rowKey];
      return n;
    });
    setRows((all) => {
      const list = all[kind] || [];
      const target = list.find((r) => r.key === rowKey);
      if (!target) return all;
      return {
        ...all,
        [kind]: list.map((r) =>
          r.key === rowKey || (col.recordLevel && target.recordId && r.recordId === target.recordId)
            ? { ...r, [col.key]: value }
            : r,
        ),
      };
    });
  };

  const addRows = (n: number) => {
    const t = teamFilter || teams[0]?.id || "";
    setRows((all) => ({
      ...all,
      [kind]: [
        ...Array.from({ length: n }, () => ({
          key: newKey(),
          lineIndex: LINE_KINDS.includes(kind) ? 0 : null,
          teamId: t,
          date: today(),
          quantity: "",
          unitPrice: "",
          cash: "",
          amount: "",
          note: "",
          reason: "",
        })),
        ...(all[kind] || []),
      ],
    }));
  };

  const removeRow = (row: SheetRow) => {
    if (row.recordId) {
      const siblings = current.filter((r) => r.recordId === row.recordId).length;
      if (!window.confirm(siblings > 1 ? `This entry has ${siblings} product lines. Delete the whole entry?` : "Delete this entry? It is kept in history as void."))
        return;
      setVoids((v) => [...v, { recordId: row.recordId, version: row.version }]);
      setRows((all) => ({ ...all, [kind]: (all[kind] || []).filter((r) => r.recordId !== row.recordId) }));
    } else setRows((all) => ({ ...all, [kind]: (all[kind] || []).filter((r) => r.key !== row.key) }));
  };

  const paste = (e: React.ClipboardEvent<HTMLElement>, rowKey: string, colKey: string) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const editable = cols.filter((c) => c.type !== "readonly");
    const start = editable.findIndex((c) => c.key === colKey);
    const visibleKeys = visible.map((r) => r.key);
    const first = visibleKeys.indexOf(rowKey);
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line, li) => {
        const rk = visibleKeys[first + li];
        if (!rk) return;
        line.split("\t").forEach((cell, ci) => {
          const col = editable[start + ci];
          if (!col) return;
          let value = cell.trim();
          if (col.type === "select") value = col.options?.find((o) => o.label.toLowerCase() === value.toLowerCase() || o.value === value)?.value ?? "";
          setCell(rk, col, value);
        });
      });
  };

  /** Rebuilds each record's data from its rows. */
  const dataFor = (k: string, list: SheetRow[], original?: Row) => {
    const head = list[0];
    const base: Row = original ? JSON.parse(JSON.stringify(original.data || {})) : {};
    const set = (field: string, value: any) => {
      if (value === "" || value === undefined) delete base[field];
      else base[field] = value;
    };
    set("note", head.note?.trim());
    if (LINE_KINDS.includes(k)) {
      const lines = original ? [...(base.lines || [])] : [];
      for (const r of list) {
        const idx = r.lineIndex ?? 0;
        const line: Row = { ...(lines[idx] || {}), productId: r.productId, quantity: r.quantity };
        if (k !== "damage") line.unitPrice = r.unitPrice;
        if (k === "sale") {
          if (r.cash === "" || r.cash === undefined) delete line.cash;
          else line.cash = r.cash;
        }
        lines[idx] = line;
      }
      base.lines = lines;
      if (k === "sale") {
        set("areaId", head.areaId);
        set("session", head.session);
      }
      if (k === "sale" || NEEDS_REASON.includes(k)) set("reason", head.reason?.trim());
    } else if (AMOUNT_KINDS.includes(k)) {
      set("amount", head.amount);
      if (k === "expense") set("expenseType", head.expenseType);
      if (k === "fund") set("round", head.round?.trim());
    } else if (k === "fgd") {
      // Drop blank trailing entries so an untouched FGD stays byte-identical.
      const compact = (prefix: string) => {
        const list = [1, 2, 3].map((i) => (head[`${prefix}${i}`] || "").trim());
        while (list.length > 1 && !list[list.length - 1]) list.pop();
        return list;
      };
      const same = (a: unknown, b: string[]) => {
        const list = (Array.isArray(a) ? a : []).map((x) => String(x ?? "").trim());
        while (list.length > 1 && !list[list.length - 1]) list.pop();
        return stable(list) === stable(b);
      };
      const findings = compact("f"),
        actions = compact("a");
      // Keep the stored arrays when nothing was edited (older entries may hold blank slots).
      if (!original || !same(original.data?.findings, findings)) base.findings = findings;
      if (!original || !same(original.data?.actions, actions)) base.actions = actions;
    } else {
      for (const f of ["segment", "objections", "whyBought", "bestArea"]) set(f, head[f]?.trim());
    }
    return base;
  };

  const lineTotal = (r: SheetRow) => {
    const q = Number(r.quantity), p = Number(r.unitPrice);
    return Number.isFinite(q * p) && r.quantity !== "" && r.unitPrice !== "" ? (q * p).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "";
  };

  const dirtyKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const [k, list] of Object.entries(rows)) {
      const byRecord = new Map<string, SheetRow[]>();
      for (const r of list) {
        if (!r.recordId) {
          // A blank added row is ignored until something is typed into it.
          if (USER_FIELDS.some((f) => r[f] !== undefined && String(r[f]).trim() !== "")) keys.add(r.key);
          continue;
        }
        byRecord.set(r.recordId, [...(byRecord.get(r.recordId) || []), r]);
      }
      for (const [id, group] of byRecord) {
        const o = originals.get(id);
        if (!o) continue;
        if (group[0].date !== o.date || group[0].teamId !== o.teamId || stable(dataFor(k, group, o)) !== stable(o.data))
          group.forEach((r) => keys.add(r.key));
      }
    }
    return keys;
  }, [rows, originals]);
  const changeCount = new Set(
    [...dirtyKeys].map((k) => {
      for (const list of Object.values(rows)) {
        const r = list.find((x) => x.key === k);
        if (r) return r.recordId || r.key;
      }
      return k;
    }),
  ).size + voids.length;

  const close = () => {
    if (changeCount && !window.confirm("You have unsaved changes. Close without saving?")) return;
    onClose();
  };

  const save = async () => {
    setBanner(null);
    const creates: Row[] = [];
    const updates: Row[] = [];
    const localErrors: Record<string, string> = {};
    for (const [k, list] of Object.entries(rows)) {
      const kcols = columns(k);
      const byRecord = new Map<string, SheetRow[]>();
      for (const r of list) {
        if (!dirtyKeys.has(r.key)) continue;
        for (const c of kcols) {
          if (c.required && (r[c.key] === undefined || String(r[c.key]).trim() === "")) {
            localErrors[r.key] = `${c.label} is required.`;
            break;
          }
          if (c.type === "number" && r[c.key] !== "" && r[c.key] !== undefined && !/^\d+(\.\d+)?$/.test(String(r[c.key]))) {
            localErrors[r.key] = `${c.label} must be a number.`;
            break;
          }
        }
        if (k !== "damage" && LINE_KINDS.includes(k) && Number(r.quantity) <= 0) localErrors[r.key] ||= "Quantity must be more than 0.";
        const id = r.recordId || r.key;
        byRecord.set(id, [...(byRecord.get(id) || []), r]);
      }
      for (const [id, group] of byRecord) {
        const o = group[0].recordId ? originals.get(id) : undefined;
        if (o) updates.push({ key: group[0].key, recordId: id, version: o.version, date: group[0].date, data: dataFor(k, group, o) });
        else creates.push({ key: group[0].key, kind: k, teamId: group[0].teamId, date: group[0].date, data: dataFor(k, group) });
      }
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setBanner({ tone: "error", text: `${Object.keys(localErrors).length} row(s) need attention. Nothing was saved.` });
      return;
    }
    if (!creates.length && !updates.length && !voids.length) {
      setBanner({ tone: "error", text: "There are no changes to save." });
      return;
    }
    if (reason.trim().length < 3) {
      setBanner({ tone: "error", text: "Write a short reason for these changes (at least 3 characters)." });
      return;
    }
    setSaving(true);
    try {
      const out = await onSave({ reason: reason.trim(), creates, updates, voids });
      setBanner({ tone: "ok", text: `Saved — ${out.created ?? 0} added, ${out.updated ?? 0} updated, ${out.voided ?? 0} deleted.` });
      setReason("");
    } catch (e) {
      const message = (e as Error).message || "Could not save.";
      const m = /^\[\[(.+?)\]\]\s*(.*)$/.exec(message);
      if (m) {
        setErrors({ [m[1]]: m[2] });
        for (const [k, list] of Object.entries(rows))
          if (list.some((r) => r.key === m[1])) {
            const isIndividual = INDIVIDUAL_KINDS.some(([x]) => x === k);
            setGroup(isIndividual ? "individual" : "team");
            setKind(k);
          }
        setBanner({ tone: "error", text: `${m[2]} Nothing was saved.` });
      } else setBanner({ tone: "error", text: `${message} Nothing was saved.` });
    } finally {
      setSaving(false);
    }
  };

  const needle = search.trim().toLowerCase();
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name || "";
  const visible = current.filter(
    (r) =>
      (!teamFilter || r.teamId === teamFilter) &&
      (!needle ||
        isNew(r) ||
        [teamName(r.teamId), r.enteredByName, r.date, r.note, products.find((p) => p.id === r.productId)?.name]
          .join(" ")
          .toLowerCase()
          .includes(needle)),
  );
  const kinds = group === "team" ? TEAM_KINDS : INDIVIDUAL_KINDS;
  const countFor = (k: string) => new Set((rows[k] || []).map((r) => r.recordId || r.key)).size;

  return (
    <div className="ds-overlay" role="dialog" aria-modal="true" aria-label="Manage data">
      <div className="ds-shell">
        <header className="ds-top">
          <div className="ds-title">
            <h2>Manage data — {bundle.program?.name}</h2>
            <p>Edit cells, add or delete rows, then save. Everything is checked together; if one row is wrong, nothing is saved.</p>
          </div>
          <div className="ds-actions">
            {changeCount > 0 && <span className="ds-pill warn">{changeCount} unsaved change{changeCount > 1 ? "s" : ""}</span>}
            <button className="ds-btn ghost" onClick={close}>
              <X size={15} /> Close
            </button>
          </div>
        </header>

        <div className="ds-groups" role="tablist" aria-label="Sheet group">
          {(
            [
              ["team", "Team-wise data"],
              ["individual", "Individual data"],
            ] as const
          ).map(([g, label]) => (
            <button
              key={g}
              role="tab"
              aria-selected={group === g}
              className={group === g ? "active" : ""}
              onClick={() => {
                setGroup(g);
                setKind(g === "team" ? "sale" : "fgd");
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ds-tabs" role="tablist" aria-label="Sheet">
          {kinds.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "active" : ""} onClick={() => setKind(k)}>
              {label}
              <span>{countFor(k)}</span>
            </button>
          ))}
        </div>

        <div className="ds-toolbar">
          <label className="ds-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team, product, member, note…" />
          </label>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label="Filter by team">
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="ds-spacer" />
          {CREATABLE.includes(kind) ? (
            <>
              <button className="ds-btn" onClick={() => addRows(1)}>
                <Plus size={15} /> Add row
              </button>
              <button className="ds-btn" onClick={() => addRows(5)}>
                <Plus size={15} /> Add 5 rows
              </button>
            </>
          ) : (
            <span className="ds-hint">
              {kind === "purchase"
                ? "New purchases need a voucher — add them from the entry form. Existing rows can be edited here."
                : "New entries of this type link to other records — add them from the entry form."}
            </span>
          )}
        </div>

        {banner && <div className={`ds-banner ${banner.tone}`}>{banner.text}</div>}

        <div className="ds-grid-wrap">
          <table className="ds-grid">
            <thead>
              <tr>
                <th className="ds-sticky ds-num">#</th>
                <th className="ds-del" aria-label="Delete" />
                {cols.map((c) => (
                  <th key={c.key} style={{ minWidth: c.width }}>
                    {c.label}
                    {c.required && <b aria-hidden> *</b>}
                  </th>
                ))}
                <th style={{ minWidth: 140 }}>Entered by</th>
                <th style={{ minWidth: 100 }}>ID</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 4} className="ds-empty">
                    No rows in this sheet{CREATABLE.includes(kind) ? " yet — use “Add row” to start." : "."}
                  </td>
                </tr>
              )}
              {visible.map((r, i) => {
                const err = errors[r.key];
                const dirty = dirtyKeys.has(r.key);
                return (
                  <tr key={r.key} className={err ? "error" : dirty ? "dirty" : isNew(r) ? "new" : ""} title={err}>
                    <td className="ds-sticky ds-num">{i + 1}</td>
                    <td className="ds-del">
                      <button aria-label="Delete row" onClick={() => removeRow(r)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                    {cols.map((c) => (
                      <td key={c.key} className={c.type === "number" || c.key === "total" ? "num" : ""}>
                        {c.type === "readonly" ? (
                          <span className="ds-ro">{c.key === "total" ? lineTotal(r) : r[c.key]}</span>
                        ) : c.type === "select" ? (
                          <select
                            value={r[c.key] || ""}
                            onChange={(e) => setCell(r.key, c, e.target.value)}
                            disabled={c.key === "teamId" && !!r.recordId}
                            aria-label={c.label}
                          >
                            <option value="">—</option>
                            {c.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={c.type === "date" ? "date" : "text"}
                            inputMode={c.type === "number" ? "decimal" : undefined}
                            max={c.type === "date" ? today() : undefined}
                            value={r[c.key] ?? ""}
                            onChange={(e) => setCell(r.key, c, e.target.value)}
                            onPaste={(e) => paste(e, r.key, c.key)}
                            aria-label={c.label}
                          />
                        )}
                      </td>
                    ))}
                    <td>
                      <span className="ds-ro">{r.enteredByName || (isNew(r) ? "New" : "")}</span>
                    </td>
                    <td>
                      <span className="ds-ro">
                        <code>{r.recordId ? r.recordId.slice(0, 8) : "—"}</code>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {Object.keys(errors).length > 0 && (
            <ul className="ds-errors">
              {Object.entries(errors).map(([k, msg]) => {
                const where = Object.entries(rows).find(([, list]) => list.some((r) => r.key === k));
                const label = [...TEAM_KINDS, ...INDIVIDUAL_KINDS].find(([x]) => x === where?.[0])?.[1];
                const index = where ? where[1].findIndex((r) => r.key === k) + 1 : 0;
                return (
                  <li key={k}>
                    {label ? `${label}, row ${index}: ` : ""}
                    {msg}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="ds-bottom">
          <input
            className="ds-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for these changes (required, e.g. “Fixing day 3 sales from paper records”)"
          />
          <button className="ds-btn primary" disabled={saving || changeCount === 0} onClick={save}>
            <Save size={15} /> {saving ? "Saving…" : `Save changes${changeCount ? ` (${changeCount})` : ""}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
