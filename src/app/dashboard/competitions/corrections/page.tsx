"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { formatAnswer, formatReportDate } from "@/lib/competitions";

interface CorrectionRow {
  id: string;
  requesterRoll: string;
  requesterName: string;
  reason: string;
  newData: Record<string, any>;
  oldData: Record<string, any> | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  competition: { id: string; title: string; batchName: string; schema: any[] };
  submission: {
    id: string;
    type: string;
    teamName: string | null;
    rollNumber: string;
    studentName: string;
    data: Record<string, any>;
    reportDate: string;
  };
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const absentText = (data: Record<string, any> | null | undefined) =>
  Array.isArray(data?.absentRolls) ? data!.absentRolls.join(", ") : "";

export default function CompetitionCorrectionsPage() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/competitions/corrections?status=${status}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load correction requests");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (row: CorrectionRow, action: "approve" | "reject") => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/competitions/corrections/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[row.id] || "" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || "Failed to update request");
      } else {
        toast.success(action === "approve" ? "Approved — the report has been corrected." : "Request rejected.");
      }
      load();
    } catch {
      toast.error("Error updating request");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/competitions" className="hover:text-emerald-600 font-medium">Competitions</Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">Correction Requests</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Correction Requests</h1>
          <p className="text-sm text-slate-500 mt-1">
            Students ask to fix a report they already submitted. Approving replaces the old answers with the requested ones.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="bg-slate-50 border border-slate-300 text-slate-800 px-4 py-2.5 rounded-lg font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600 mb-2"></div>
          <p className="text-sm">Loading requests...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-12 text-center text-slate-500">
          No {status === "all" ? "" : status} correction requests.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            // Once approved the submission already holds the new answers, so
            // "before" comes from the snapshot taken at approval.
            const before = row.status === "approved" && row.oldData ? row.oldData : row.submission.data;
            const fields = [
              ...row.competition.schema.map((f: any) => ({
                key: f.id,
                label: f.label,
                oldVal: formatAnswer(f, before?.[f.id]),
                newVal: formatAnswer(f, row.newData?.[f.id]),
              })),
              ...(row.submission.type === "team"
                ? [{ key: "__absent", label: "Absent Members", oldVal: absentText(before), newVal: absentText(row.newData) }]
                : []),
            ];
            return (
              <div key={row.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-bold text-slate-900">
                      {row.competition.title} <span className="font-medium text-slate-500">· {row.competition.batchName}</span>
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      <strong>{formatReportDate(row.submission.reportDate)}</strong> ·{" "}
                      {row.submission.type === "team" ? `Team report (${row.submission.teamName || "—"})` : "Individual report"} · requested by{" "}
                      <span className="font-mono text-emerald-700 font-bold">{row.requesterRoll}</span> {row.requesterName}
                    </p>
                  </div>
                  <span className={`self-start text-xs font-bold uppercase px-2.5 py-1 rounded border ${STATUS_STYLE[row.status]}`}>{row.status}</span>
                </div>

                <div className="p-5 space-y-4">
                  <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Reason</span>
                    <p className="text-slate-800 whitespace-pre-line mt-0.5">{row.reason || "—"}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border border-slate-200 rounded-lg">
                      <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Field</th>
                          <th className="px-4 py-2.5">Current / Old</th>
                          <th className="px-4 py-2.5">Requested</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {fields.map((f) => {
                          const changed = f.oldVal !== f.newVal;
                          return (
                            <tr key={f.key} className={changed ? "bg-amber-50/60" : ""}>
                              <td className="px-4 py-2.5 font-semibold text-slate-700">{f.label}</td>
                              <td className={`px-4 py-2.5 whitespace-pre-line ${changed ? "text-red-700 line-through" : "text-slate-600"}`}>{f.oldVal || "—"}</td>
                              <td className={`px-4 py-2.5 whitespace-pre-line ${changed ? "text-emerald-800 font-bold" : "text-slate-600"}`}>{f.newVal || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {row.status === "pending" ? (
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <input
                        type="text"
                        value={notes[row.id] || ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        placeholder="Note for the student (optional)"
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        onClick={() => review(row, "reject")}
                        disabled={busyId === row.id}
                        className="px-5 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-bold hover:bg-red-100 disabled:opacity-50 transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => review(row, "approve")}
                        disabled={busyId === row.id}
                        className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm disabled:opacity-50 transition"
                      >
                        Approve & Apply
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {row.status === "approved" ? "Approved" : "Rejected"} by {row.reviewedBy || "—"}
                      {row.reviewedAt ? ` on ${new Date(row.reviewedAt).toLocaleString("en-GB")}` : ""}
                      {row.reviewNote ? ` — ${row.reviewNote}` : ""}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
