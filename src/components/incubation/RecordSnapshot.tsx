import { productLabel } from "@/lib/incubation/catalog";

const lineKey = (l: any) =>
  l ? `${l.productId}|${l.quantity}|${l.unitPrice ?? ""}|${l.cash ?? ""}` : "";

export default function RecordSnapshot({
  record,
  products = [],
  categories = [],
  compare,
}: {
  record: any;
  products?: any[];
  /** Shows each product's category, so same-named products can be told apart. */
  categories?: any[];
  /** The other side of a comparison; lines and fields that differ are highlighted. */
  compare?: any;
}) {
  const d = record?.data || record || {};
  const other = compare ? compare.data || compare : null;
  const fields = [
    ["Amount", "amount"],
    ["Reason", "reason"],
    ["Note", "note"],
    ["Expense type", "expenseType"],
    ["Segment", "segment"],
    ["Objections", "objections"],
    ["Why they bought", "whyBought"],
    ["Best area", "bestArea"],
  ];
  const changed = (a: unknown, b: unknown) => !!other && String(a ?? "") !== String(b ?? "");
  return (
    <dl style={{ fontSize: 12, lineHeight: 1.8 }}>
      {record?.status === "void" && (
        <div role="alert" className="inc-notice inc-error" style={{ marginBottom: 10 }}>
          <b>এটি পুরো এন্ট্রি বাতিল (VOID) করার অনুরোধ।</b> অনুমোদন করলে নিচের লাইনগুলোসহ পুরো
          এন্ট্রিটি হিসাব থেকে বাদ যাবে — শুধু পরিবর্তন নয়।
        </div>
      )}
      {record?.date && (
        <div className={compare && changed(record.date, compare.date) ? "inc-diff" : ""}>
          <dt className="inc-sub">Date</dt>
          <dd>{record.date}</dd>
        </div>
      )}
      {d.lines?.map((l: any, i: number) => {
        const p = products.find((p) => p.id === l.productId);
        const category = categories.find((c) => c.id === p?.parentId)?.name;
        return (
          <div
            key={i}
            style={{ marginBottom: 10 }}
            className={other && lineKey(l) !== lineKey(other.lines?.[i]) ? "inc-diff" : ""}
          >
            <dt className="inc-sub">
              {productLabel(p) || l.productId}
              {category && <small> · {category}</small>}
            </dt>
            <dd>
              {l.quantity} × BDT {l.unitPrice || 0}
              {l.cash !== undefined && ` • received BDT ${l.cash}`}
            </dd>
          </div>
        );
      })}
      {fields
        .filter(([, k]) => d[k] !== undefined && d[k] !== "")
        .map(([label, k]) => (
          <div key={k} className={changed(d[k], other?.[k]) ? "inc-diff" : ""}>
            <dt className="inc-sub">{label}</dt>
            <dd>{d[k]}</dd>
          </div>
        ))}
      {["findings", "actions"].map((key) =>
        d[key]?.length ? (
          <div key={key}>
            <dt className="inc-sub">
              {key === "findings" ? "Findings" : "Actions"}
            </dt>
            {d[key].map((v: string, i: number) => (
              <dd key={i}>
                {i + 1}. {v}
              </dd>
            ))}
          </div>
        ) : null,
      )}
    </dl>
  );
}
