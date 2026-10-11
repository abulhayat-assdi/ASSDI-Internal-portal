"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import CompetitionFormFields from "@/components/competitions/CompetitionFormFields";
import { formatAnswer, formatReportDate, validateFormData, type GroupMember } from "@/lib/competitions";

interface Submission {
  id: string;
  type: "team" | "individual";
  scope: "mine" | "team" | "teammate";
  rollNumber: string;
  studentName: string;
  data: Record<string, any>;
  reportDate: string;
  submittedAt: string;
  canRequestCorrection: boolean;
}

interface Correction {
  id: string;
  submissionId: string;
  requesterName: string;
  requesterRoll: string;
  reason: string;
  newData: Record<string, any>;
  oldData: Record<string, any> | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
}

interface Detail {
  competition: { id: string; title: string; description: string | null; batchName: string; schema: any[]; isActive: boolean };
  me: { roll: string; name: string };
  team: { id: string; groupName: string; members: GroupMember[]; role: "leader" | "deputy" | "member"; canSubmitTeam: boolean } | null;
  today: string;
  dateFieldId: string | null;
  submissions: Submission[];
  corrections: Correction[];
}

type Tab = "submit" | "mine" | "team" | "corrections";

const ROLE_LABEL: Record<string, string> = { leader: "Team Leader", deputy: "Deputy Leader", member: "Member" };
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default function StudentCompetitionPage() {
  const { id } = useParams() as { id: string };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("submit");

  // Submit form
  const [subType, setSubType] = useState<"team" | "individual">("individual");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [reportDate, setReportDate] = useState("");
  const [absentRolls, setAbsentRolls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Correction modal
  const [correcting, setCorrecting] = useState<Submission | null>(null);
  // Only the answers being replaced; what was submitted is shown read-only.
  const [correctionChanges, setCorrectionChanges] = useState<Record<string, any>>({});
  const [changeAbsent, setChangeAbsent] = useState(false);
  const [correctionAbsent, setCorrectionAbsent] = useState<string[]>([]);
  const [correctionReason, setCorrectionReason] = useState("");
  const [sendingCorrection, setSendingCorrection] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/competitions/${id}`);
      if (!res.ok) {
        setDetail(null);
        return;
      }
      const data: Detail = await res.json();
      setDetail(data);
      setReportDate((prev) => prev || data.today);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const schema = detail?.competition.schema || [];
  const team = detail?.team || null;
  const canSubmitTeam = Boolean(team?.canSubmitTeam);
  const activeType = canSubmitTeam ? subType : "individual";
  const teammates = (team?.members || []).filter((m) => m.roll !== detail?.me.roll);

  const pendingBySubmission = useMemo(() => {
    const map = new Set<string>();
    (detail?.corrections || []).forEach((c) => c.status === "pending" && map.add(c.submissionId));
    return map;
  }, [detail]);

  const mySubmissions = (detail?.submissions || []).filter((s) => s.scope === "mine");
  const teamSubmissions = (detail?.submissions || []).filter((s) => s.scope === "team");
  const teammateSubmissions = (detail?.submissions || []).filter((s) => s.scope === "teammate");

  const toggle = (list: string[], roll: string) => (list.includes(roll) ? list.filter((r) => r !== roll) : [...list, roll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const invalid = validateFormData(schema, formData);
    if (invalid) return toast.error(invalid);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/competitions/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeType,
          reportDate,
          data: formData,
          absentRolls: activeType === "team" ? absentRolls : [],
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || "Submission failed", { duration: 7000 });
        // That day is already filed: carry what was just typed into a
        // correction request for it instead of making them start over.
        if (res.status === 409) {
          const day = detail.dateFieldId ? formData[detail.dateFieldId] : reportDate;
          const existing = detail.submissions.find(
            (s) => s.scope === (activeType === "team" ? "team" : "mine") && s.reportDate === day
          );
          if (existing?.canRequestCorrection && !pendingBySubmission.has(existing.id)) {
            openCorrection(existing);
            setCorrectionChanges(
              Object.fromEntries(correctableFields.filter((f: any) => isChanged(f, formData[f.id], existing)).map((f: any) => [f.id, formData[f.id]]))
            );
            if (activeType === "team" && !sameRolls(absentRolls, absentOf(existing))) {
              setChangeAbsent(true);
              setCorrectionAbsent(absentRolls);
            }
          }
        }
        return;
      }
      toast.success("Submitted successfully!");
      setFormData({});
      setAbsentRolls([]);
      await load();
      setTab(activeType === "team" ? "team" : "mine");
    } catch {
      toast.error("Error submitting form");
    } finally {
      setSubmitting(false);
    }
  };

  // Everything except the date, which identifies the report and stays fixed.
  const correctableFields = schema.filter((f: any) => f.id !== detail?.dateFieldId);
  const absentOf = (sub: Submission): string[] => (Array.isArray(sub.data?.absentRolls) ? sub.data.absentRolls.map(String) : []);
  const sameRolls = (a: string[], b: string[]) => [...a].sort().join(",") === [...b].sort().join(",");
  const isBlank = (v: any) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  const isChanged = (field: any, value: any, sub: Submission) =>
    !isBlank(value) && formatAnswer(field, value) !== formatAnswer(field, sub.data?.[field.id]);

  const openCorrection = (sub: Submission) => {
    setCorrecting(sub);
    setCorrectionChanges({});
    setChangeAbsent(false);
    setCorrectionAbsent(absentOf(sub));
    setCorrectionReason("");
  };

  const sendCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correcting) return;
    if (!correctionReason.trim()) return toast.error("Please write what needs to be corrected.");
    const changed = correctableFields.filter((f: any) => isChanged(f, correctionChanges[f.id], correcting));
    const absentChanged = correcting.type === "team" && changeAbsent && !sameRolls(correctionAbsent, absentOf(correcting));
    if (changed.length === 0 && !absentChanged) return toast.error("কোনো পরিবর্তন দেওয়া হয়নি। যে উত্তরটি ঠিক করতে চান তার নতুন মান লিখুন।");
    const correctedData = { ...correcting.data, ...Object.fromEntries(changed.map((f: any) => [f.id, correctionChanges[f.id]])) };
    const invalid = validateFormData(schema, correctedData);
    if (invalid) return toast.error(invalid);

    setSendingCorrection(true);
    try {
      const res = await fetch(`/api/student/competitions/${id}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: correcting.id,
          reason: correctionReason,
          data: correctedData,
          absentRolls: absentChanged ? correctionAbsent : absentOf(correcting),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || "Could not send the request");
        return;
      }
      toast.success("Correction request sent. It will apply after approval.");
      setCorrecting(null);
      await load();
      setTab("corrections");
    } catch {
      toast.error("Error sending correction request");
    } finally {
      setSendingCorrection(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-2"></div>
        <p className="text-sm">Loading competition...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 p-8 rounded-2xl text-center shadow-sm">
        <p className="text-xl font-bold text-slate-800">Competition Not Available</p>
        <p className="text-sm text-slate-500 mt-2">This competition was not found for your batch.</p>
        <Link href="/student-dashboard/competitions" className="inline-block mt-4 text-sm font-bold text-emerald-700">
          ← Back to Competitions
        </Link>
      </div>
    );
  }

  const { competition, me } = detail;

  const renderTable = (rows: Submission[], showWho: boolean, emptyText: string) =>
    rows.length === 0 ? (
      <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Date</th>
              {showWho && <th className="px-4 py-3 whitespace-nowrap">Submitted By</th>}
              {schema
                .filter((f: any) => f.id !== detail.dateFieldId)
                .map((f: any) => (
                  <th key={f.id} className="px-4 py-3 whitespace-nowrap">{f.label}</th>
                ))}
              <th className="px-4 py-3 text-right whitespace-nowrap">Correction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((sub) => (
              <tr key={sub.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{formatReportDate(sub.reportDate)}</td>
                {showWho && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-emerald-700 font-bold">{sub.rollNumber}</span>{" "}
                    <span className="text-slate-700">{sub.studentName}</span>
                  </td>
                )}
                {schema
                  .filter((f: any) => f.id !== detail.dateFieldId)
                  .map((f: any) => (
                    <td key={f.id} className="px-4 py-3 text-slate-700 whitespace-pre-line max-w-xs">
                      {formatAnswer(f, sub.data?.[f.id]) || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {pendingBySubmission.has(sub.id) ? (
                    <span className="text-xs font-bold px-2 py-1 rounded border bg-amber-50 text-amber-800 border-amber-200">Pending</span>
                  ) : sub.canRequestCorrection ? (
                    <button
                      onClick={() => openCorrection(sub)}
                      className="text-blue-700 hover:text-blue-900 font-semibold text-xs bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 transition"
                    >
                      Request Correction
                    </button>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "submit", label: "📝 Submit Report" },
    { key: "mine", label: "👤 My Reports", count: mySubmissions.length },
    ...(team ? [{ key: "team" as Tab, label: "👥 Team Data", count: teamSubmissions.length + teammateSubmissions.length }] : []),
    { key: "corrections", label: "🛠 Corrections", count: detail.corrections.length },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-2xl p-6 sm:p-8 text-white shadow-sm">
        <Link href="/student-dashboard/competitions" className="text-xs font-bold text-emerald-50 hover:text-white">
          ← All Competitions
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2" style={{ color: "#fff", WebkitTextFillColor: "#fff", backgroundImage: "none" }}>
          {competition.title}
        </h1>
        {competition.description && <p className="mt-2 text-sm text-emerald-50 max-w-2xl">{competition.description}</p>}
        <div className="flex flex-wrap gap-2 mt-4 text-xs font-bold">
          <span className="bg-white/20 border border-white/30 px-3 py-1 rounded-full">
            {me.roll} · {me.name}
          </span>
          <span className="bg-white/20 border border-white/30 px-3 py-1 rounded-full">
            {team ? `${team.groupName} · ${ROLE_LABEL[team.role]}` : "No team"}
          </span>
          {!competition.isActive && <span className="bg-red-500/80 border border-white/30 px-3 py-1 rounded-full">Ended</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
              tab === t.key ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 opacity-80">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Submit */}
      {tab === "submit" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          {!competition.isActive ? (
            <p className="p-10 text-center text-sm text-slate-500">This competition has ended and is no longer accepting reports.</p>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-6">
              {/* Submission type */}
              <div className="bg-slate-100 p-3 sm:p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Submission Type</label>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {(["individual", "team"] as const).map((t) => {
                    const disabled = t === "team" && !canSubmitTeam;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSubType(t)}
                        className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap border disabled:opacity-50 disabled:cursor-not-allowed ${
                          activeType === t ? "bg-emerald-600 text-white border-emerald-600 shadow-md" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span>{t === "team" ? "👥" : "👤"}</span>
                        <span>{t === "team" ? `Team-wise${team ? ` (${team.groupName})` : ""}` : "Individual"}</span>
                      </button>
                    );
                  })}
                </div>
                {!canSubmitTeam && (
                  <p className="text-xs text-slate-500 mt-2.5">
                    {team
                      ? "Team-wise report can only be submitted by your team leader or deputy leader."
                      : "You are not in a team yet, so you can only submit an individual report."}
                  </p>
                )}
              </div>

              {/* Report date — only when the form has no date question of its own */}
              {!detail.dateFieldId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Report Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    max={detail.today}
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full sm:w-64 bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-medium"
                  />
                </div>
              )}

              {/* Absent members (team reports only) */}
              {activeType === "team" && teammates.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 p-3.5 sm:p-4 rounded-xl space-y-2.5">
                  <label className="block text-xs font-bold text-amber-950">
                    টিমের মধ্যে কেউ অনুপস্থিত থাকলে তাকে সিলেক্ট করুন (Optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {teammates.map((m) => {
                      const on = absentRolls.includes(m.roll);
                      return (
                        <button
                          key={m.roll}
                          type="button"
                          onClick={() => setAbsentRolls((prev) => toggle(prev, m.roll))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            on ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-700 border-amber-300 hover:bg-amber-100"
                          }`}
                        >
                          {m.roll} · {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200"></div>

              <CompetitionFormFields schema={schema} formData={formData} onChange={setFormData} maxDate={detail.today} />

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-base py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>🚀</span> {submitting ? "Submitting..." : `Submit ${activeType === "team" ? "Team" : "Individual"} Report`}
              </button>
              <p className="text-xs text-slate-500 text-center">
                প্রতি তারিখে একবারই জমা দেওয়া যাবে। ভুল হলে জমা দেওয়ার পর &quot;Request Correction&quot; ব্যবহার করুন।
              </p>
            </form>
          )}
        </div>
      )}

      {/* My reports */}
      {tab === "mine" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-bold text-slate-800">My Individual Reports</h2>
          </div>
          {renderTable(mySubmissions, false, "You have not submitted any individual report yet.")}
        </div>
      )}

      {/* Team data */}
      {tab === "team" && team && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-3">{team.groupName} — Members</h2>
            <div className="flex flex-wrap gap-1.5">
              {team.members.map((m) => (
                <span
                  key={m.roll}
                  className={`px-2 py-1 rounded text-xs border font-medium inline-flex items-center gap-1.5 ${
                    m.isLeader ? "bg-amber-50 text-amber-900 border-amber-300" : m.isDeputy ? "bg-sky-50 text-sky-900 border-sky-300" : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  <strong>{m.roll}</strong> {m.name}
                  {m.isLeader && <span className="bg-amber-500 text-white text-[10px] font-bold uppercase px-1.5 py-px rounded">Leader</span>}
                  {m.isDeputy && <span className="bg-sky-600 text-white text-[10px] font-bold uppercase px-1.5 py-px rounded">Deputy</span>}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-bold text-slate-800">Team-wise Reports</h2>
            </div>
            {renderTable(teamSubmissions, true, "No team report has been submitted yet.")}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-bold text-slate-800">Teammates&apos; Individual Reports</h2>
            </div>
            {renderTable(teammateSubmissions, true, "Your teammates have not submitted any individual report yet.")}
          </div>
        </div>
      )}

      {/* Corrections */}
      {tab === "corrections" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-bold text-slate-800">Correction Requests</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              To request one, open My Reports or Team Data and click &quot;Request Correction&quot; on the date you want to fix.
            </p>
          </div>
          {detail.corrections.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No correction request yet.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {detail.corrections.map((c) => {
                const sub = detail.submissions.find((s) => s.id === c.submissionId);
                return (
                  <div key={c.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="text-sm">
                      <p className="font-bold text-slate-900">
                        {sub ? formatReportDate(sub.reportDate) : "—"}{" "}
                        <span className="font-semibold text-slate-500">· {sub?.type === "team" ? "Team report" : "Individual report"}</span>
                      </p>
                      <p className="text-slate-700 mt-1 whitespace-pre-line">{c.reason}</p>
                      {sub && (
                        <ul className="mt-2 space-y-1 text-xs">
                          {schema
                            .map((f: any) => {
                              // Once approved the report already holds the new answers.
                              const before = c.status === "approved" && c.oldData ? c.oldData : sub.data;
                              return { f, from: formatAnswer(f, before?.[f.id]), to: formatAnswer(f, c.newData?.[f.id]) };
                            })
                            .filter((d: any) => d.from !== d.to)
                            .map((d: any) => (
                              <li key={d.f.id} className="text-slate-600 whitespace-pre-line">
                                <span className="font-bold text-slate-700">{d.f.label}:</span>{" "}
                                <span className="text-red-700 line-through">{d.from || "—"}</span> →{" "}
                                <span className="text-emerald-800 font-bold">{d.to || "—"}</span>
                              </li>
                            ))}
                        </ul>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        Requested by {c.requesterName} on {new Date(c.createdAt).toLocaleString("en-GB")}
                      </p>
                      {c.reviewNote && <p className="text-xs text-slate-600 mt-1">Admin note: {c.reviewNote}</p>}
                    </div>
                    <span className={`self-start text-xs font-bold uppercase px-2.5 py-1 rounded border ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Correction modal */}
      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold" style={{ color: "#fff", WebkitTextFillColor: "#fff", backgroundImage: "none" }}>
                Request Correction — {formatReportDate(correcting.reportDate)} ({correcting.type === "team" ? "Team" : "Individual"})
              </h3>
              <button onClick={() => setCorrecting(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={sendCorrection} className="p-6 space-y-5 overflow-y-auto">
              <p className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                আগে জমা দেওয়া উত্তর পরিবর্তন করা যাবে না। যে উত্তরটি ভুল, শুধু তার নিচে সঠিক উত্তর লিখুন; বাকিগুলো ফাঁকা রাখুন। অ্যাডমিন approve করলে নতুন উত্তর বসে যাবে।
              </p>

              {correctableFields.map((field: any) => {
                const changed = isChanged(field, correctionChanges[field.id], correcting);
                return (
                  <div key={field.id} className={`rounded-xl border overflow-hidden ${changed ? "border-emerald-400" : "border-slate-200"}`}>
                    <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{field.label}</p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-2">জমা দেওয়া উত্তর</p>
                      <p className="text-sm font-medium text-slate-900 whitespace-pre-line">
                        {formatAnswer(field, correcting.data?.[field.id]) || "—"}
                      </p>
                    </div>
                    <div className="p-4 space-y-2">
                      <CompetitionFormFields
                        schema={[{ ...field, label: "সঠিক উত্তর (পরিবর্তন না থাকলে ফাঁকা রাখুন)", required: false }]}
                        formData={correctionChanges}
                        onChange={setCorrectionChanges}
                      />
                      {!isBlank(correctionChanges[field.id]) && (
                        <button
                          type="button"
                          onClick={() => setCorrectionChanges(({ [field.id]: _removed, ...rest }) => rest)}
                          className="text-xs font-bold text-slate-500 hover:text-red-600"
                        >
                          ✕ এই পরিবর্তন বাদ দিন
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {correcting.type === "team" && team && (
                <div className={`rounded-xl border overflow-hidden ${changeAbsent ? "border-emerald-400" : "border-slate-200"}`}>
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Absent members</p>
                    <p className="text-[11px] font-semibold text-slate-500 mt-2">জমা দেওয়া উত্তর</p>
                    <p className="text-sm font-medium text-slate-900">
                      {absentOf(correcting)
                        .map((roll) => `${roll} · ${team.members.find((m) => m.roll === roll)?.name || ""}`)
                        .join(", ") || "কেউ অনুপস্থিত নয়"}
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={changeAbsent}
                        onChange={(e) => {
                          setChangeAbsent(e.target.checked);
                          setCorrectionAbsent(absentOf(correcting));
                        }}
                        className="accent-emerald-600 w-4 h-4"
                      />
                      অনুপস্থিত তালিকা পরিবর্তন করতে চাই
                    </label>
                    {changeAbsent && (
                      <div className="flex flex-wrap gap-2">
                        {team.members.map((m) => {
                          const on = correctionAbsent.includes(m.roll);
                          return (
                            <button
                              key={m.roll}
                              type="button"
                              onClick={() => setCorrectionAbsent((prev) => toggle(prev, m.roll))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                on ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-700 border-amber-300 hover:bg-amber-100"
                              }`}
                            >
                              {m.roll} · {m.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  What needs to be corrected? <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="কী ভুল হয়েছিল এবং কী ঠিক করতে চান লিখুন"
                  className="w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setCorrecting(null)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={sendingCorrection} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold shadow-md transition">
                  {sendingCorrection ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
