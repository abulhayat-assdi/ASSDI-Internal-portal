export default function RecordSnapshot({
  record,
  products = [],
}: {
  record: any;
  products?: any[];
}) {
  const d = record?.data || record || {};
  const fields = [
    ["Amount", d.amount],
    ["Reason", d.reason],
    ["Note", d.note],
    ["Expense type", d.expenseType],
    ["Segment", d.segment],
    ["Objections", d.objections],
    ["Why they bought", d.whyBought],
    ["Best area", d.bestArea],
  ];
  return (
    <dl style={{ fontSize: 12, lineHeight: 1.8 }}>
      {record?.date && (
        <>
          <dt className="inc-sub">Date</dt>
          <dd>{record.date}</dd>
        </>
      )}
      {d.lines?.map((l: any, i: number) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <dt className="inc-sub">
            {products.find((p) => p.id === l.productId)?.name || l.productId}
          </dt>
          <dd>
            {l.quantity} × BDT {l.unitPrice || 0}
            {l.cash !== undefined && ` • received BDT ${l.cash}`}
          </dd>
        </div>
      ))}
      {fields
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k}>
            <dt className="inc-sub">{k}</dt>
            <dd>{v}</dd>
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
