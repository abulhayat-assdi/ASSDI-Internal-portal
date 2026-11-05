"use client";
import { useState } from "react";
const local = (iso: string) =>
  new Date(iso)
    .toLocaleString("sv-SE", { timeZone: "Asia/Dhaka" })
    .replace(" ", "T")
    .slice(0, 16);
async function send(programId: string, action: string, payload: unknown) {
  const r = await fetch("/api/incubation/field", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId, action, payload }),
    }),
    d = await r.json();
  if (!r.ok) throw Error(d.error);
  return d;
}
export function FieldCorrectionEditor({
  bundle,
  onSaved,
  onError,
}: {
  bundle: any;
  onSaved: () => void;
  onError: (s: string) => void;
}) {
  const [session, setSession] = useState<any>(null),
    [form, setForm] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const eligible = bundle.fields.filter(
    (f: any) => f.checkOut && (bundle.manager || f.userId === bundle.actor.id),
  );
  if (!eligible.length) return null;
  return (
    <section className="inc-card" style={{ marginTop: 20 }}>
      <h2>মাঠের তথ্য সংশোধন</h2>
      <p className="inc-sub">
        আগের সময়/এলাকা/স্টেপ অপরিবর্তনযোগ্য থাকবে। নতুন তথ্য অনুমোদনের পর
        কার্যকর হবে। GPS স্থানাঙ্ক হাতে পরিবর্তন করা যায় না।
      </p>
      <label className="inc-field">
        সেশন
        <select
          value={session?.id || ""}
          onChange={(e) => {
            const s = eligible.find((x: any) => x.id === e.target.value);
            setSession(s);
            if (s)
              setForm({
                checkIn: local(s.checkIn),
                checkOut: local(s.checkOut),
                startAreaId: s.startAreaId,
                endAreaId: s.endAreaId,
                steps: s.steps,
              });
          }}
        >
          <option value="">সেশন বাছুন</option>
          {eligible.map((f: any) => (
            <option key={f.id} value={f.id}>
              {f.userName} • {local(f.checkIn).replace("T", " ")}
            </option>
          ))}
        </select>
      </label>
      {session && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await send(bundle.program.id, "field_correct", {
                sessionId: session.id,
                version: session.version,
                reason,
                proposed: {
                  ...form,
                  checkIn: new Date(`${form.checkIn}:00+06:00`).toISOString(),
                  checkOut: new Date(`${form.checkOut}:00+06:00`).toISOString(),
                  steps: Number(form.steps),
                },
              });
              setSession(null);
              setReason("");
              onSaved();
            } catch (e) {
              onError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="inc-form-grid" style={{ marginTop: 15 }}>
            <aside className="inc-old">
              <h3>আগের তথ্য</h3>
              <p>শুরু: {local(session.checkIn).replace("T", " ")}</p>
              <p>শেষ: {local(session.checkOut).replace("T", " ")}</p>
              <p>স্টেপ: {session.steps}</p>
              <p>
                শুরু/শেষ এলাকা:{" "}
                {
                  bundle.catalog.find((a: any) => a.id === session.startAreaId)
                    ?.name
                }{" "}
                /{" "}
                {
                  bundle.catalog.find((a: any) => a.id === session.endAreaId)
                    ?.name
                }
              </p>
            </aside>
            <div className="inc-form-grid">
              {["checkIn", "checkOut"].map((k) => (
                <label key={k} className="inc-field">
                  {k === "checkIn" ? "নতুন শুরু" : "নতুন শেষ"}
                  <input
                    required
                    type="datetime-local"
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </label>
              ))}
              {["startAreaId", "endAreaId"].map((k) => (
                <label key={k} className="inc-field">
                  {k === "startAreaId" ? "শুরুর এলাকা" : "শেষের এলাকা"}
                  <select
                    required
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  >
                    {bundle.catalog
                      .filter((c: any) => c.kind === "area")
                      .map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              <label className="inc-field">
                নতুন স্টেপ
                <input
                  required
                  type="number"
                  min="0"
                  max="200000"
                  value={form.steps}
                  onChange={(e) => setForm({ ...form, steps: e.target.value })}
                />
              </label>
            </div>
          </div>
          <label className="inc-field" style={{ marginTop: 14 }}>
            কারণ
            <textarea
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            className="inc-btn primary"
            style={{ marginTop: 14 }}
            disabled={busy}
          >
            {busy
              ? "সংরক্ষণ হচ্ছে…"
              : bundle.manager
                ? "সংশোধন সংরক্ষণ"
                : "অনুরোধ পাঠান"}
          </button>
        </form>
      )}
    </section>
  );
}
export function FieldCorrectionReviews({
  bundle,
  onSaved,
  onError,
}: {
  bundle: any;
  onSaved: () => void;
  onError: (s: string) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState("");
  return (
    <section style={{ marginTop: 24 }}>
      <h2>মাঠের তথ্যের সংশোধন অনুরোধ</h2>
      {!bundle.fieldCorrections?.length && (
        <p className="inc-sub">কোনো অনুরোধ নেই।</p>
      )}
      <div className="inc-grid">
        {bundle.fieldCorrections?.map((r: any) => (
          <article className="inc-card" key={r.id}>
            <div className="inc-row inc-between">
              <b>{r.requestedByName}</b>
              <span className={`inc-status ${r.status}`}>{r.status}</span>
            </div>
            <p>{r.reason}</p>
            <div className="inc-form-grid">
              {[
                ["আগে", r.before],
                ["প্রস্তাবিত", r.proposed],
              ].map(([title, d]: any) => (
                <div className="inc-old" key={title}>
                  <b>{title}</b>
                  <p>
                    {local(d.checkIn).replace("T", " ")}
                    <br />
                    {local(d.checkOut).replace("T", " ")}
                  </p>
                  <p>{d.steps} স্টেপ</p>
                </div>
              ))}
            </div>
            {bundle.supervisor && r.status === "pending" && (
              <>
                <textarea
                  aria-label="মাঠের সংশোধনের পর্যালোচনা নোট"
                  placeholder="পর্যালোচনার নোট"
                  style={{ marginTop: 12 }}
                  value={notes[r.id] || ""}
                  onChange={(e) =>
                    setNotes({ ...notes, [r.id]: e.target.value })
                  }
                />
                <div className="inc-row" style={{ marginTop: 12 }}>
                  {[true, false].map((approve) => (
                    <button
                      key={String(approve)}
                      className={`inc-btn ${approve ? "primary" : "danger"}`}
                      disabled={!!busy || (notes[r.id] || "").trim().length < 3}
                      onClick={async () => {
                        setBusy(r.id);
                        try {
                          await send(bundle.program.id, "field_review", {
                            id: r.id,
                            approve,
                            reason: notes[r.id],
                          });
                          onSaved();
                        } catch (e) {
                          onError((e as Error).message);
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      {approve ? "অনুমোদন" : "প্রত্যাখ্যান"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
