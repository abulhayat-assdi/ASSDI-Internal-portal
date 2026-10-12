"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { formatTaka, procurementByTeam, procurementTotals, type ProcurementLike } from "@/lib/competitions";

interface Props {
  competitionId: string;
  entries: ProcurementLike[];
}

/** Team-wise totals of what each team took from staff and what it still owes. */
export default function ProcurementSummary({ competitionId, entries }: Props) {
  const byTeam = useMemo(() => procurementByTeam(entries), [entries]);
  const totals = useMemo(() => procurementTotals(entries), [entries]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
          <span className="p-1.5 bg-purple-100 rounded-lg text-purple-700 text-base">🛒</span>
          Procurement
        </h2>
        <Link
          href={`/dashboard/competitions/${competitionId}/procurement`}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
        >
          Manage Procurement →
        </Link>
      </div>
      {byTeam.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No procurement recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3 text-right">Pieces Taken</th>
                <th className="px-5 py-3 text-right">Total Amount</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {byTeam.map((t) => (
                <tr key={t.groupId} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900">{t.groupName}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{t.quantity.toLocaleString("en-US")}</td>
                  <td className="px-5 py-3 text-right text-slate-700 font-medium">{formatTaka(t.total)}</td>
                  <td className="px-5 py-3 text-right text-emerald-700 font-medium">{formatTaka(t.paid)}</td>
                  <td className={`px-5 py-3 text-right font-bold ${t.due > 0 ? "text-red-600" : "text-slate-400"}`}>{formatTaka(t.due)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-emerald-50 border-t-2 border-emerald-200 font-black text-emerald-900">
              <tr>
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-right">{totals.quantity.toLocaleString("en-US")}</td>
                <td className="px-5 py-3 text-right">{formatTaka(totals.total)}</td>
                <td className="px-5 py-3 text-right">{formatTaka(totals.paid)}</td>
                <td className="px-5 py-3 text-right text-red-700">{formatTaka(totals.due)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
