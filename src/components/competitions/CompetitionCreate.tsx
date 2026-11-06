"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import FormCompetitionCreate from "./FormCompetitionCreate";
import IncubationApp from "@/components/incubation/IncubationApp";
import "@/components/incubation/incubation.css";
export default function CompetitionCreate() {
  const [kind, setKind] = useState(""),
    [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch("/api/competitions")
      .then((r) => r.json())
      .then(setData);
  }, []);
  if (kind === "form")
    return (
      <>
        <button className="inc-btn" onClick={() => setKind("")}>
          ← Competition type
        </button>
        <FormCompetitionCreate />
      </>
    );
  if (kind === "business_incubation") return <IncubationApp create />;
  return (
    <main className="inc">
      <header className="inc-head">
        <h1>Create New Competition</h1>
        <p>কাজের ধরন নির্বাচন করুন</p>
      </header>
      <Link
        href="/dashboard/competitions"
        className="inc-btn"
        style={{ margin: "20px 0" }}
      >
        ← Competitions
      </Link>
      <div className="inc-grid">
        <section className="inc-card">
          <h2>Form-based Competition</h2>
          <p>Battle of Cups, Corporate Sales অথবা আপনার custom report form।</p>
          <button
            className="inc-btn primary"
            disabled={!data?.canCreateForm}
            onClick={() => setKind("form")}
          >
            ফর্ম তৈরি করুন
          </button>
        </section>
        <section className="inc-card">
          <h2>Business Incubation</h2>
          <p>
            টিম, ক্যাটাগরি রোটেশন, পণ্য, ক্রয়-বিক্রয়, ফান্ড, মাঠের কাজ ও FGD।
          </p>
          <button
            className="inc-btn primary"
            disabled={!data?.canCreateIncubation}
            onClick={() => setKind("business_incubation")}
          >
            Incubation তৈরি করুন
          </button>
        </section>
      </div>
      {data?.error && <p role="alert">{data.error}</p>}
    </main>
  );
}
