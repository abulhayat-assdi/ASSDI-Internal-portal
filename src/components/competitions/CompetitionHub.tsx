"use client";
import { useEffect, useState } from "react";
import { STATUS_LABELS } from "@/lib/incubation/lifecycle";
import Link from "next/link";
import {
  Trophy,
  ArrowUpRight,
  Plus,
  Users,
  ClipboardCheck,
} from "lucide-react";
import "@/components/incubation/incubation.css";
import "@/components/incubation/incubation-glass.css";
export default function CompetitionHub({
  student = false,
}: {
  student?: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("running");
  useEffect(() => {
    fetch(student ? "/api/student/competitions" : "/api/competitions", {
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [student]);
  const rows = (data?.competitions || []).filter(
    (c: any) =>
      filter === "all" ||
      (filter === "running"
        ? c.state === "running"
        : filter === "upcoming"
          ? ["scheduled", "draft"].includes(c.state)
          : filter === "incubation"
            ? c.kind === "business_incubation"
            : ["ended", "closed", "closing", "archived", "cancelled"].includes(c.state)),
  );
  return (
    <main className="inc">
      <header className="inc-head">
        <div className="inc-eyebrow">LEARN · PRACTISE · COMPETE</div>
        <h1>Competitions</h1>
        <p>
          {student
            ? "Open your running competitions and see your team and role."
            : "Manage form competitions and Business Incubation in one place."}
        </p>
        {!student && (
          <div className="inc-row">
            {(data?.canCreateForm || data?.canCreateIncubation) && (
              <Link className="inc-btn" href="/dashboard/competitions/create">
                <Plus size={17} />
                Create New
              </Link>
            )}
            {data?.canCreateForm && (
              <>
                <Link className="inc-btn" href="/dashboard/competitions/groups">
                  <Users size={17} />
                  Form competition groups
                </Link>
                <Link
                  className="inc-btn"
                  href="/dashboard/competitions/corrections"
                >
                  <ClipboardCheck size={17} />
                  Form correction requests
                </Link>
              </>
            )}
          </div>
        )}
      </header>
      <nav className="inc-tabs" aria-label="Competition filter">
        {[
          ["running", "Running"],
          ["upcoming", "Upcoming / draft"],
          ["all", "All"],
          ["incubation", "Business Incubation"],
          ["ended", "Ended / history"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={filter === v ? "active" : ""}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="inc-notice inc-error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading competitions…</p>}
      <div className="inc-grid">
        {rows.map((c: any) => (
          <article className="inc-card" key={c.id}>
            <div className="inc-row inc-between">
              <Trophy size={22} />
              <span className={`inc-status ${c.state}`}>
                {STATUS_LABELS[c.state] || c.state}
              </span>
            </div>
            <p className="inc-eyebrow" style={{ marginTop: 20 }}>
              {c.kind === "business_incubation"
                ? "Business Incubation"
                : "Form Competition"}
            </p>
            <h2>{c.title}</h2>
            <p className="inc-sub">{c.description}</p>
            <p>{c.batchNames?.join(" · ")}</p>
            {student && (
              <p>
                {c.team
                  ? c.team.name +
                    " · " +
                    (c.team.role === "leader" ? "Team lead" : "Member")
                  : c.kind === "business_incubation"
                    ? "You have not been added to a team yet."
                    : data.team?.groupName || "No team assigned"}
              </p>
            )}
            {c.canOpen ? (
              <Link
                className="inc-btn primary"
                href={
                  (student
                    ? "/student-dashboard/competitions/"
                    : "/dashboard/competitions/") +
                  c.id +
                  (!student && c.kind === "form" ? "/report" : "")
                }
              >
                {student ? "Open my workspace" : "Manage"}
                <ArrowUpRight size={16} />
              </Link>
            ) : (
              <span className="inc-notice">Available once you are added to a team</span>
            )}
            {!student && c.kind === "business_incubation" && data?.canCreateIncubation && (
              <div className="inc-row" style={{ marginTop: 12 }}>
                <button
                  className="inc-btn danger"
                  onClick={async () => {
                    const typed = window.prompt(
                      `Delete "${c.title}"?

It will disappear for everyone (students, staff and the public link). Its records stay in the database history.

Type the program name to confirm:`,
                    );
                    if (typed === null) return;
                    const reason = window.prompt("Reason for deleting (for example: created twice by mistake):");
                    if (!reason) return;
                    const r = await fetch("/api/incubation", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "delete_program",
                        programId: c.programId,
                        payload: { confirmName: typed, reason },
                      }),
                    });
                    if (r.ok)
                      setData({
                        ...data,
                        competitions: data.competitions.filter((v: any) => v.id !== c.id),
                      });
                    else setError((await r.json()).error);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
            {!student && c.kind === "form" && (
              <div className="inc-row" style={{ marginTop: 12 }}>
                <Link
                  className="inc-btn"
                  href={"/dashboard/competitions/" + c.id + "/edit"}
                >
                  Edit form
                </Link>
                <Link
                  className="inc-btn"
                  href={"/dashboard/competitions/" + c.id + "/procurement"}
                >
                  Procurement
                </Link>
                <button
                  className="inc-btn danger"
                  onClick={async () => {
                    if (!window.confirm("Delete " + c.title + "?")) return;
                    const r = await fetch("/api/competitions/" + c.id, {
                      method: "DELETE",
                    });
                    if (r.ok)
                      setData({
                        ...data,
                        competitions: data.competitions.filter(
                          (v: any) => v.id !== c.id,
                        ),
                      });
                    else setError((await r.json()).error);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {data && !rows.length && (
        <div className="inc-empty">
          <Trophy />
          <h2>No competitions in this list</h2>
          <p>
            Try another filter. New drafts appear under “Upcoming / draft”
            and “All”.
          </p>
        </div>
      )}
    </main>
  );
}
