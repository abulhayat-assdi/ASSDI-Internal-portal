"use client";
import { useMemo, useState } from "react";
import { X, Table2 } from "lucide-react";
import RecordSnapshot from "./RecordSnapshot";
interface Props {
  records: any[];
  products: any[];
  programId: string;
  onSaved: () => void;
  onError: (s: string) => void;
}
const columns = [
  "date",
  "productId",
  "quantity",
  "unitPrice",
  "cash",
  "amount",
  "note",
];
export default function BulkSheetEditor({
  records,
  products,
  programId,
  onSaved,
  onError,
}: Props) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<any[]>([]),
    [preview, setPreview] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const originals = useMemo(
    () => new Map(records.map((r) => [r.id, r])),
    [records],
  );
  const consistencyError = useMemo(() => {
    const metadata = new Map<string, { date: string; note: string }>();
    for (const row of rows) {
      const first = metadata.get(row.recordId);
      if (first && (first.date !== row.date || first.note !== row.note))
        return "একই রেকর্ডের সব লাইনে তারিখ ও নোট এক হতে হবে। যেকোনো একটি লাইনে সঠিক তারিখ/নোট লিখলে অন্য লাইনগুলোও মিলবে।";
      metadata.set(row.recordId, { date: row.date, note: row.note });
    }
    return "";
  }, [rows]);
  const changes = useMemo(() => {
    const grouped = new Map<string, any>();
    for (const row of rows) {
      const old = originals.get(row.recordId);
      if (!old) continue;
      let changed = grouped.get(old.id);
      if (!changed) {
        changed = {
          recordId: old.id,
          version: old.version,
          date: row.date,
          data: JSON.parse(JSON.stringify(old.data)),
        };
        grouped.set(old.id, changed);
      }
      if (row.lineIndex !== null) {
        changed.data.lines[row.lineIndex] = {
          ...changed.data.lines[row.lineIndex],
          productId: row.productId,
          quantity: row.quantity,
          ...(row.unitPrice !== "" ? { unitPrice: row.unitPrice } : {}),
          ...(old.kind === "sale" && row.cash !== "" ? { cash: row.cash } : {}),
        };
        if (old.kind === "sale" && row.cash === "")
          delete changed.data.lines[row.lineIndex].cash;
      } else if (old.data.amount !== undefined)
        changed.data.amount = row.amount;
      if (row.note !== (old.data.note || "")) changed.data.note = row.note;
    }
    return [...grouped.values()].filter((c) => {
      const old = originals.get(c.recordId);
      return (
        c.date !== old.date ||
        JSON.stringify(c.data) !== JSON.stringify(old.data)
      );
    });
  }, [rows, originals]);
  const start = () => {
    const eligible = records.filter((r) => r.status === "posted");
    if (eligible.length > 200) {
      onError(
        "একবারে সর্বোচ্চ ২০০টি রেকর্ড এডিট করা যায়। তারিখ/টিমের ফিল্টার ছোট করুন।",
      );
      return;
    }
    setRows(
      eligible.flatMap((r) =>
        r.data.lines?.length
          ? r.data.lines.map((l: any, i: number) => ({
              recordId: r.id,
              lineIndex: i,
              date: r.date,
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice ?? "",
              cash: l.cash ?? "",
              amount: "",
              note: r.data.note || "",
            }))
          : [
              {
                recordId: r.id,
                lineIndex: null,
                date: r.date,
                productId: "",
                quantity: "",
                unitPrice: "",
                cash: "",
                amount: r.data.amount || "",
                note: r.data.note || "",
              },
            ],
      ),
    );
    setOpen(true);
    setPreview(false);
    setError("");
  };
  const change = (index: number, key: string, value: string) =>
    setRows((prior) =>
      prior.map((r, i) =>
        i === index
          ? { ...r, [key]: value }
          : key === "date" || key === "note"
            ? r.recordId === prior[index].recordId
              ? { ...r, [key]: value }
              : r
            : r,
      ),
    );
  const paste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    index: number,
    col: number,
  ) => {
    const raw = event.clipboardData.getData("text");
    if (!raw.includes("\t") && !raw.includes("\n")) return;
    event.preventDefault();
    const lines = raw
      .trimEnd()
      .split(/\r?\n/)
      .map((l) => l.split("\t"));
    setRows((prior) => {
      if (index + lines.length > prior.length) {
        setError(
          "Paste-এর সারি বর্তমান শিটের বাইরে যাচ্ছে। নতুন এন্ট্রির জন্য ফর্ম ব্যবহার করুন।",
        );
        return prior;
      }
      const next = prior.map((r) => ({ ...r }));
      lines.forEach((line, i) =>
        line.forEach((value, j) => {
          const key = columns[col + j];
          if (key && key !== "productId") next[index + i][key] = value;
        }),
      );
      return next;
    });
  };
  return (
    <>
      <button
        className="inc-btn"
        onClick={start}
        disabled={!records.some((r) => r.status === "posted")}
      >
        <Table2 size={15} />
        শিটে একসঙ্গে এডিট
      </button>
      {open && (
        <div className="inc-modal-bg">
          <form
            className="inc-modal"
            style={{ width: "min(1300px,100%)" }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (consistencyError) {
                setError(consistencyError);
                return;
              }
              setError("");
              if (!preview) {
                setPreview(true);
                return;
              }
              setBusy(true);
              try {
                const r = await fetch("/api/incubation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "bulk_correct",
                      programId,
                      payload: { changes, reason },
                    }),
                  }),
                  d = await r.json();
                if (!r.ok) throw Error(d.error);
                setOpen(false);
                onSaved();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="inc-modal-head inc-row inc-between">
              <h2>{preview ? "পরিবর্তন যাচাই" : "শিট এডিট"}</h2>
              <button
                type="button"
                className="inc-btn"
                aria-label="শিট এডিট বন্ধ"
                onClick={() => !busy && setOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="inc-modal-body">
              {error && <div className="inc-notice inc-error">{error}</div>}
              <div className="inc-notice">
                তারিখ ও নোট একই রেকর্ডের সব লাইনে প্রযোজ্য। Excel থেকে
                tab-separated সংখ্যা paste করা যায়। সব পরিবর্তন একসঙ্গে যাচাই ও
                সংরক্ষণ হবে; কোনো একটি ভুল হলে কিছুই বদলাবে না।
              </div>
              {preview ? (
                <>
                  <p>{changes.length}টি রেকর্ড পরিবর্তন হবে।</p>
                  {changes.map((c) => (
                    <div className="inc-old" key={c.recordId}>
                      <b>
                        {c.recordId.slice(0, 8)} • {c.date}
                      </b>
                      <div className="inc-form-grid">
                        <div>
                          <small>আগে</small>
                          <RecordSnapshot
                            record={originals.get(c.recordId)}
                            products={products}
                          />
                        </div>
                        <div>
                          <small>পরে</small>
                          <RecordSnapshot record={c} products={products} />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="inc-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "তারিখ",
                          "পণ্য",
                          "পরিমাণ",
                          "একক মূল্য",
                          "পাওয়া টাকা",
                          "টাকা",
                          "নোট",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={`${r.recordId}-${r.lineIndex}`}>
                          {columns.map((key, col) => (
                            <td
                              key={key}
                              style={{
                                minWidth:
                                  key === "note"
                                    ? 220
                                    : key === "productId"
                                      ? 190
                                      : 130,
                              }}
                            >
                              {key === "productId" ? (
                                <select
                                  disabled={r.lineIndex === null}
                                  value={r.productId}
                                  onChange={(e) =>
                                    change(i, key, e.target.value)
                                  }
                                >
                                  <option value="">—</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={key === "date" ? "date" : "text"}
                                  value={r[key]}
                                  disabled={
                                    key === "amount"
                                      ? r.lineIndex !== null
                                      : [
                                            "quantity",
                                            "unitPrice",
                                            "cash",
                                          ].includes(key)
                                        ? r.lineIndex === null
                                        : false
                                  }
                                  onChange={(e) =>
                                    change(i, key, e.target.value)
                                  }
                                  onPaste={(e) => paste(e, i, col)}
                                />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <label className="inc-field">
                এডিটের কারণ
                <textarea
                  required
                  minLength={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
            <div className="inc-modal-foot">
              {preview && (
                <button
                  type="button"
                  className="inc-btn"
                  disabled={busy}
                  onClick={() => setPreview(false)}
                >
                  আবার এডিট
                </button>
              )}
              <button
                className="inc-btn primary"
                disabled={busy || !changes.length}
              >
                {busy
                  ? "যাচাই ও সংরক্ষণ হচ্ছে…"
                  : preview
                    ? "সব পরিবর্তন সংরক্ষণ"
                    : "পরিবর্তন প্রিভিউ"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
