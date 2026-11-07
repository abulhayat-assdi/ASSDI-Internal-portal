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
            ? "আপনার টিম ও দায়িত্ব অনুযায়ী চলমান কাজে যোগ দিন।"
            : "এক জায়গায় ফর্মভিত্তিক প্রতিযোগিতা ও Business Incubation পরিচালনা করুন।"}
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
          ["running", "চলমান"],
          ["upcoming", "আসন্ন / খসড়া"],
          ["all", "সব"],
          ["incubation", "Business Incubation"],
          ["ended", "শেষ / ইতিহাস"],
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
      {!data && !error && <p role="status">Competitions লোড হচ্ছে…</p>}
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
                    (c.team.role === "leader" ? "টিম লিডার" : "সদস্য")
                  : c.kind === "business_incubation"
                    ? "আপনাকে এখনো টিমে যুক্ত করা হয়নি।"
                    : data.team?.groupName || "টিম নির্ধারিত নেই"}
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
                {student ? "আমার কাজ খুলুন" : "পরিচালনা করুন"}
                <ArrowUpRight size={16} />
              </Link>
            ) : (
              <span className="inc-notice">টিমে যুক্ত হলে খুলতে পারবেন</span>
            )}
            {!student && c.kind === "form" && (
              <div className="inc-row" style={{ marginTop: 12 }}>
                <Link
                  className="inc-btn"
                  href={"/dashboard/competitions/" + c.id + "/edit"}
                >
                  ফর্ম এডিট
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
                    if (!window.confirm(c.title + " মুছে ফেলবেন?")) return;
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
                  মুছুন
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {data && !rows.length && (
        <div className="inc-empty">
          <Trophy />
          <h2>এই তালিকায় কোনো competition নেই</h2>
          <p>
            অন্য filter নির্বাচন করুন। নতুন তৈরি করা খসড়া “সব” তালিকায় পাওয়া
            যাবে।
          </p>
        </div>
      )}
    </main>
  );
}
