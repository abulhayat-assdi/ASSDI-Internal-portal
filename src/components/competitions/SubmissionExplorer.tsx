"use client";

import React, { useMemo, useState } from "react";
import { findGroupForRoll, formatAnswer, formatReportDate, getDateFieldId, type GroupLike } from "@/lib/competitions";

interface Props {
  /** Report payload: schema, submissions (each with effectiveDate) and the batch's groups. */
  competition: any;
}

type GroupBy = "none" | "date" | "team" | "student";

const NO_TEAM = "No Team";

const isTeamRow = (s: any) => s.type === "team" || Boolean(s.teamName && s.teamName.trim() !== "");

const isSummable = (f: any) =>
  f.type === "short_text" && (f.validation === "number" || (f.mapping && !["none", "team_name", "day_number"].includes(f.mapping)));

const selectClass =
  "bg-white text-slate-800 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none w-full";

/**
 * Filterable view of every submitted row: by type, team, student and date
 * range, optionally rolled up per day / team / student, with Excel export of
 * whatever is currently shown.
 */
export default function SubmissionExplorer({ competition }: Props) {
  const [type, setType] = useState<"all" | "team" | "individual">("all");
  const [team, setTeam] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const schema: any[] = Array.isArray(competition.schema) ? competition.schema : [];
  const groups: GroupLike[] = useMemo(() => (Array.isArray(competition.groups) ? competition.groups : []), [competition.groups]);
  const dateFieldId = getDateFieldId(schema);
  const columns = schema.filter((f) => f.id !== dateFieldId);
  const sumFields = columns.filter(isSummable);

  // Normalised rows: every row knows its day, kind and team.
  const rows = useMemo(() => {
    return (competition.submissions || []).map((s: any) => {
      const teamRow = isTeamRow(s);
      const teamName = teamRow
        ? s.teamName || groups.find((g) => g.id === s.groupId)?.groupName || NO_TEAM
        : findGroupForRoll(groups, s.rollNumber)?.groupName || NO_TEAM;
      return { ...s, kind: teamRow ? "team" : "individual", teamLabel: teamName, day: s.effectiveDate as string };
    });
  }, [competition, groups]);

  const teamOptions = useMemo(
    () => Array.from(new Set<string>(rows.map((r: any) => r.teamLabel))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r: any) => {
        if (type !== "all" && r.kind !== type) return false;
        if (team !== "all" && r.teamLabel !== team) return false;
        if (from && r.day < from) return false;
        if (to && r.day > to) return false;
        if (q && !`${r.rollNumber} ${r.studentName}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a: any, b: any) => b.day.localeCompare(a.day) || a.teamLabel.localeCompare(b.teamLabel, undefined, { numeric: true }));
  }, [rows, type, team, search, from, to]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    sumFields.forEach((f) => (t[f.id] = filtered.reduce((acc: number, r: any) => acc + Number(r.data?.[f.id] || 0), 0)));
    return t;
  }, [filtered, sumFields]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [];
    const map = new Map<string, { key: string; label: string; count: number; sums: Record<string, number> }>();
    filtered.forEach((r: any) => {
      const key = groupBy === "date" ? r.day : groupBy === "team" ? r.teamLabel : r.rollNumber;
      const label = groupBy === "date" ? formatReportDate(r.day) : groupBy === "team" ? r.teamLabel : `${r.rollNumber} · ${r.studentName}`;
      if (!map.has(key)) map.set(key, { key, label, count: 0, sums: {} });
      const g = map.get(key)!;
      g.count += 1;
      sumFields.forEach((f) => (g.sums[f.id] = (g.sums[f.id] || 0) + Number(r.data?.[f.id] || 0)));
    });
    const list = Array.from(map.values());
    return groupBy === "date"
      ? list.sort((a, b) => b.key.localeCompare(a.key))
      : list.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }, [filtered, groupBy, sumFields]);

  const hasFilters = type !== "all" || team !== "all" || search || from || to;
  const reset = () => {
    setType("all");
    setTeam("all");
    setSearch("");
    setFrom("");
    setTo("");
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const detailRows = filtered.map((r: any) => {
      const row: Record<string, any> = {
        Date: r.day,
        Type: r.kind,
        Team: r.teamLabel,
        Roll: r.rollNumber,
        Name: r.studentName,
      };
      columns.forEach((f) => (row[f.label] = isSummable(f) ? Number(r.data?.[f.id] || 0) : formatAnswer(f, r.data?.[f.id])));
      if (r.kind === "team") row["Absent Rolls"] = Array.isArray(r.data?.absentRolls) ? r.data.absentRolls.join(", ") : "";
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows.length ? detailRows : [{}]), "Filtered Data");
    if (groupBy !== "none") {
      const summaryRows = grouped.map((g) => {
        const row: Record<string, any> = { [groupBy === "date" ? "Date" : groupBy === "team" ? "Team" : "Student"]: g.label, Reports: g.count };
        sumFields.forEach((f) => (row[f.label] = g.sums[f.id] || 0));
        return row;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{}]), "Summary");
    }
    XLSX.writeFile(wb, `${String(competition.title || "competition").replace(/\s+/g, "_")}_Filtered.xlsx`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
          <span className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700 text-base">🔎</span>
          Data Explorer
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
            {filtered.length} of {rows.length} reports
          </span>
          <button
            onClick={exportExcel}
            disabled={filtered.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
          >
            📥 Export Filtered
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 sm:p-5 border-b border-slate-200 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Report Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className={selectClass}>
            <option value="all">All</option>
            <option value="team">Team-wise</option>
            <option value="individual">Individual</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Team</label>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className={selectClass}>
            <option value="all">All Teams</option>
            {teamOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Student (Roll / Name)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. 1218 or Rahim" className={selectClass} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectClass} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Summarise By</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={selectClass}>
            <option value="none">Every report (no summary)</option>
            <option value="date">Day</option>
            <option value="team">Team</option>
            <option value="student">Student</option>
          </select>
        </div>
        {hasFilters && (
          <button onClick={reset} className="col-span-full justify-self-start text-xs font-bold text-emerald-700 hover:text-emerald-900">
            ✕ Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No report matches these filters.</p>
      ) : groupBy !== "none" ? (
        <div className="overflow-x-auto max-h-[32rem]">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">{groupBy === "date" ? "Day" : groupBy === "team" ? "Team" : "Student"}</th>
                <th className="px-5 py-3 text-right whitespace-nowrap">Reports</th>
                {sumFields.map((f) => (
                  <th key={f.id} className="px-5 py-3 text-right whitespace-nowrap">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {grouped.map((g) => (
                <tr key={g.key} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900 whitespace-nowrap">{g.label}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{g.count}</td>
                  {sumFields.map((f) => (
                    <td key={f.id} className="px-5 py-3 text-right text-slate-700 font-medium">{(g.sums[f.id] || 0).toLocaleString()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-emerald-50 border-t-2 border-emerald-200 font-black text-emerald-900">
              <tr>
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-right">{filtered.length}</td>
                {sumFields.map((f) => (
                  <td key={f.id} className="px-5 py-3 text-right">{(totals[f.id] || 0).toLocaleString()}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[32rem]">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Date</th>
                <th className="px-5 py-3 whitespace-nowrap">Type</th>
                <th className="px-5 py-3 whitespace-nowrap">Team</th>
                <th className="px-5 py-3 whitespace-nowrap">Submitted By</th>
                {columns.map((f) => (
                  <th key={f.id} className={`px-5 py-3 whitespace-nowrap ${isSummable(f) ? "text-right" : ""}`}>{f.label}</th>
                ))}
                <th className="px-5 py-3 whitespace-nowrap">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 align-top">
                  <td className="px-5 py-3 font-bold text-slate-900 whitespace-nowrap">{formatReportDate(r.day)}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span
                      className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${
                        r.kind === "team" ? "bg-purple-50 text-purple-800 border-purple-200" : "bg-sky-50 text-sky-800 border-sky-200"
                      }`}
                    >
                      {r.kind}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-700 font-medium whitespace-nowrap">{r.teamLabel}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-emerald-700 font-bold">{r.rollNumber}</span>{" "}
                    <span className="text-slate-700">{r.studentName}</span>
                  </td>
                  {columns.map((f) => (
                    <td key={f.id} className={`px-5 py-3 text-slate-700 whitespace-pre-line max-w-xs ${isSummable(f) ? "text-right font-medium" : ""}`}>
                      {formatAnswer(f, r.data?.[f.id]) || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-amber-800 text-xs font-semibold whitespace-nowrap">
                    {Array.isArray(r.data?.absentRolls) && r.data.absentRolls.length > 0 ? r.data.absentRolls.join(", ") : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {sumFields.length > 0 && (
              <tfoot className="sticky bottom-0 bg-emerald-50 border-t-2 border-emerald-200 font-black text-emerald-900">
                <tr>
                  <td className="px-5 py-3" colSpan={4}>Total ({filtered.length} reports)</td>
                  {columns.map((f) => (
                    <td key={f.id} className="px-5 py-3 text-right">{isSummable(f) ? (totals[f.id] || 0).toLocaleString() : ""}</td>
                  ))}
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
