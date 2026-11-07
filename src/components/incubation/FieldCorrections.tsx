"use client";
import { numberInputProps } from "./numeric";
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
      <h2>Correct a field session</h2>
      <p className="inc-sub">
        The original times, areas and steps are kept. New values take effect
        after approval. GPS coordinates cannot be edited.
      </p>
      <label className="inc-field">
        Session
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
          <option value="">Select a session</option>
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
              <h3>Current values</h3>
              <p>Check in: {local(session.checkIn).replace("T", " ")}</p>
              <p>Check out: {local(session.checkOut).replace("T", " ")}</p>
              <p>Steps: {session.steps}</p>
              <p>
                Start/end area:{" "}
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
                  {k === "checkIn" ? "New check in" : "New check out"}
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
                  {k === "startAreaId" ? "Start area" : "End area"}
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
                New steps
                <input
                  required
                  {...numberInputProps(form.steps, (v) => setForm({ ...form, steps: v }), false)}
                />
              </label>
            </div>
          </div>
          <label className="inc-field" style={{ marginTop: 14 }}>
            Reason
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
              ? "Saving…"
              : bundle.manager
                ? "Save correction"
                : "Send request"}
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
      <h2>Field session correction requests</h2>
      {!bundle.fieldCorrections?.length && (
        <p className="inc-sub">No requests.</p>
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
                ["Before", r.before],
                ["Proposed", r.proposed],
              ].map(([title, d]: any) => (
                <div className="inc-old" key={title}>
                  <b>{title}</b>
                  <p>
                    {local(d.checkIn).replace("T", " ")}
                    <br />
                    {local(d.checkOut).replace("T", " ")}
                  </p>
                  <p>{d.steps} steps</p>
                </div>
              ))}
            </div>
            {bundle.supervisor && r.status === "pending" && (
              <>
                <textarea
                  aria-label="Review note for field correction"
                  placeholder="Review note"
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
                      {approve ? "Approve" : "Reject"}
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
