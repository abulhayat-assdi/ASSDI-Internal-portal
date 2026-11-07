"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  normaliseBulkRows,
  stableStringify,
  type BulkRowError,
  type BulkRowInput,
} from "@/lib/competitionBulk";

interface BulkDataGridProps {
  competition: any;
  onClose: () => void;
  onSuccess: () => void;
}

type Tab = "team" | "individual";
type Row = Record<string, any> & { id?: string; _key: string };
type Column = { key: string; label: string; type: string; numeric?: boolean };

const TABS: Tab[] = ["team", "individual"];
const REPEATER_COLUMNS = 5;
const MAX_ROWS = 1000;
let keySeed = 0;
const newKey = () => `r${++keySeed}`;
const blankRows = (n: number): Row[] => Array.from({ length: n }, () => ({ _key: newKey() }));
const hasRoll = (r: Row) => String(r.rollNumber ?? "").trim() !== "";

export default function BulkDataGrid({ competition, onClose, onSuccess }: BulkDataGridProps) {
  const schema: any[] = useMemo(
    () => (Array.isArray(competition.schema) ? competition.schema : []),
    [competition.schema],
  );
  const [activeTab, setActiveTab] = useState<Tab>("team");
  const [grids, setGrids] = useState<Record<Tab, Row[]>>({ team: [], individual: [] });
  const [originals, setOriginals] = useState<Map<string, { flat: Row; data: any; tab: Tab }>>(new Map());
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");

  const columns = useMemo(() => {
    const base: Column[] = [
      { key: "rollNumber", label: "Roll Number *", type: "short_text" },
      { key: "studentName", label: "Student Name", type: "short_text" },
    ];
    const fields: Column[] = [];
    for (const field of schema) {
      if (field.type === "repeater") {
        for (let i = 0; i < REPEATER_COLUMNS; i++) {
          for (const sub of field.subFields || []) {
            fields.push({
              key: `${field.id}_${i}_${sub.id}`,
              label: `${field.label} [${i + 1}] - ${sub.label}`,
              type: sub.type,
              numeric: sub.validation === "number",
            });
          }
        }
      } else {
        fields.push({
          key: field.id,
          label: field.label + (field.required ? " *" : ""),
          type: field.type,
          numeric: field.validation === "number" || field.type === "rating",
        });
      }
    }
    const out: Record<Tab, Column[]> = {
      team: [...base, { key: "teamName", label: "Team Name *", type: "short_text" }, ...fields],
      individual: [...base, ...fields],
    };
    return out;
  }, [schema]);

  const flatten = useCallback(
    (sub: any): Row => {
      const row: Row = {
        _key: newKey(),
        id: sub.id,
        rollNumber: sub.rollNumber || "",
        studentName: sub.studentName || "",
        teamName: sub.teamName || "",
      };
      for (const field of schema) {
        const val = sub.data?.[field.id];
        if (field.type === "repeater") {
          if (Array.isArray(val)) {
            val.slice(0, REPEATER_COLUMNS).forEach((item: any, i: number) => {
              for (const sf of field.subFields || []) {
                row[`${field.id}_${i}_${sf.id}`] = item?.[sf.id] ?? "";
              }
            });
          }
        } else if (val !== undefined && val !== null) {
          row[field.id] = String(val);
        }
      }
      return row;
    },
    [schema],
  );

  useEffect(() => {
    const team: Row[] = [];
    const individual: Row[] = [];
    const orig = new Map<string, { flat: Row; data: any; tab: Tab }>();
    for (const sub of Array.isArray(competition.submissions) ? competition.submissions : []) {
      const tab: Tab = sub.type === "team" || String(sub.teamName || "").trim() ? "team" : "individual";
      const row = flatten(sub);
      orig.set(sub.id, { flat: { ...row }, data: sub.data ?? {}, tab });
      (tab === "team" ? team : individual).push(row);
    }
    setGrids({ team: [...team, ...blankRows(15)], individual: [...individual, ...blankRows(15)] });
    setOriginals(orig);
    setDeletedIds([]);
    setRowErrors(new Map());

    if (competition.batchName) {
      fetch(`/api/batch-info?batchName=${encodeURIComponent(competition.batchName)}&public=true`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setStudents(data);
        })
        .catch(() => toast.error("শিক্ষার্থীর তালিকা আনা যায়নি; নাম হাতে লিখতে হবে।"));
    }
  }, [competition, flatten]);

  const activeColumns = columns[activeTab];
  const activeRows = grids[activeTab];
  const nameForRoll = useCallback(
    (roll: string) => students.find((s) => String(s.roll) === roll.trim())?.name as string | undefined,
    [students],
  );

  const isCellChanged = (row: Row, key: string) => {
    if (!row.id) return String(row[key] ?? "") !== "";
    const o = originals.get(row.id)?.flat;
    return String(o?.[key] ?? "") !== String(row[key] ?? "");
  };
  const isRowDirty = (row: Row, tab: Tab) => {
    if (!row.id) return hasRoll(row);
    const o = originals.get(row.id);
    if (!o) return false;
    if (o.tab !== tab) return true;
    return columns[tab].some((c) => String(o.flat[c.key] ?? "") !== String(row[c.key] ?? ""));
  };

  const updateRows = useCallback(
    (tab: Tab, fn: (rows: Row[]) => Row[]) => setGrids((g) => ({ ...g, [tab]: fn(g[tab]) })),
    [],
  );

  const clearError = (key: string | undefined) => {
    if (!key) return;
    setRowErrors((m) => {
      if (!m.has(key)) return m;
      const next = new Map(m);
      next.delete(key);
      return next;
    });
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, startRowIndex: number, startColKey: string) => {
      const text = e.clipboardData.getData("Text");
      if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // single value: normal paste
      e.preventDefault();
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      const startCol = activeColumns.findIndex((c) => c.key === startColKey);
      if (startCol === -1) return;
      updateRows(activeTab, (prev) => {
        const next = [...prev];
        lines.forEach((line, li) => {
          const target = startRowIndex + li;
          if (target >= MAX_ROWS) return;
          while (next.length <= target) next.push({ _key: newKey() });
          let row = { ...next[target] };
          line.split("\t").forEach((cell, ci) => {
            const col = activeColumns[startCol + ci];
            if (!col) return;
            row = { ...row, [col.key]: cell.trim() };
            if (col.key === "rollNumber") {
              const name = nameForRoll(cell);
              if (name) row.studentName = name;
            }
          });
          next[target] = row;
        });
        return next;
      });
      setRowErrors(new Map());
    },
    [activeColumns, activeTab, nameForRoll, updateRows],
  );

  const handleChange = (rowIndex: number, colKey: string, value: string) => {
    clearError(activeRows[rowIndex]?._key);
    updateRows(activeTab, (prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex], [colKey]: value };
      if (colKey === "rollNumber") {
        const name = nameForRoll(value);
        if (name) row.studentName = name;
      }
      next[rowIndex] = row;
      return next;
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    const row = activeRows[rowIndex];
    if (row?.id && !window.confirm(`Roll ${row.rollNumber || "?"}-এর এই row মুছে ফেলবেন? সেভ করলে তবেই মুছবে।`)) return;
    if (row?.id) setDeletedIds((d) => [...d, row.id!]);
    clearError(row?._key);
    updateRows(activeTab, (prev) => prev.filter((_, i) => i !== rowIndex));
  };

  const handleAddRow = (count = 1) => updateRows(activeTab, (prev) => [...prev, ...blankRows(count)]);

  /** Rebuilds the answers object from the flat row, keeping repeater items the grid cannot show. */
  const toData = (row: Row) => {
    const original = row.id ? originals.get(row.id)?.data ?? {} : {};
    const data: Record<string, unknown> = {};
    for (const field of schema) {
      if (field.type === "repeater") {
        const items: any[] = [];
        for (let i = 0; i < REPEATER_COLUMNS; i++) {
          const item: any = {};
          let filled = false;
          for (const sub of field.subFields || []) {
            const v = row[`${field.id}_${i}_${sub.id}`];
            if (v !== undefined && String(v).trim() !== "") {
              item[sub.id] = v;
              filled = true;
            }
          }
          if (filled) items.push(item);
        }
        const hidden = Array.isArray(original[field.id]) ? original[field.id].slice(REPEATER_COLUMNS) : [];
        if (items.length || hidden.length) data[field.id] = [...items, ...hidden];
      } else if (row[field.id] !== undefined) {
        data[field.id] = row[field.id];
      }
    }
    return data;
  };

  const dirtyCount =
    TABS.reduce((n, tab) => n + grids[tab].filter((r) => isRowDirty(r, tab)).length, 0) + deletedIds.length;

  const handleClose = () => {
    if (dirtyCount > 0 && !window.confirm("সেভ না করা পরিবর্তন আছে। সেগুলো বাদ দিয়ে বন্ধ করবেন?")) return;
    onClose();
  };

  const handleSave = async () => {
    const payload: BulkRowInput[] = [];
    const refs: { tab: Tab; key: string }[] = [];
    for (const tab of TABS) {
      for (const row of grids[tab]) {
        if (!isRowDirty(row, tab)) continue;
        if (!hasRoll(row)) {
          if (row.id) {
            setActiveTab(tab);
            setRowErrors(new Map([[row._key, "পুরোনো row-এর Roll Number ফাঁকা করা যাবে না। মুছতে চাইলে 🗑️ ব্যবহার করুন।"]]));
            toast.error("একটি পুরোনো row-এর Roll Number ফাঁকা। কিছুই সেভ হয়নি।");
            return;
          }
          continue;
        }
        payload.push({
          id: row.id,
          type: tab,
          rollNumber: String(row.rollNumber),
          studentName: row.studentName,
          teamName: tab === "team" ? row.teamName : null,
          data: toData(row),
          expected: row.id ? stableStringify(originals.get(row.id)?.data ?? {}) : undefined,
        });
        refs.push({ tab, key: row._key });
      }
    }

    if (payload.length === 0 && deletedIds.length === 0) {
      toast("কোনো পরিবর্তন নেই।");
      return;
    }

    const showErrors = (errors: BulkRowError[]) => {
      const map = new Map<string, string>();
      for (const e of errors) {
        const ref = refs[e.index];
        if (ref) map.set(ref.key, e.message);
      }
      setRowErrors(map);
      const first = refs[errors[0]?.index];
      if (first) setActiveTab(first.tab);
      toast.error(`${errors.length}টি row-এ সমস্যা আছে। লাল row-গুলো দেখুন — কিছুই সেভ হয়নি।`, { duration: 6000 });
    };

    const local = normaliseBulkRows(schema, payload);
    if (local.errors.length) {
      showErrors(local.errors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/competitions/${competition.id}/submit/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissions: payload, deletedIds }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.success) {
        toast.success(`সেভ হয়েছে — নতুন ${out.created ?? 0}, বদল ${out.updated ?? 0}, মুছে ${out.deleted ?? 0}`);
        onSuccess();
      } else if (Array.isArray(out.rowErrors) && out.rowErrors.length) {
        showErrors(out.rowErrors);
      } else {
        toast.error(out.error || "সেভ করা যায়নি। কিছুই বদলানো হয়নি।");
      }
    } catch {
      toast.error("নেটওয়ার্ক সমস্যা — সেভ হয়েছে কি না নিশ্চিত নয়। পেজ রিফ্রেশ করে দেখুন।");
    } finally {
      setIsSaving(false);
    }
  };

  const counts: Record<Tab, number> = {
    team: grids.team.filter(hasRoll).length,
    individual: grids.individual.filter(hasRoll).length,
  };
  const needle = search.trim().toLowerCase();
  const visible = activeRows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        !needle ||
        !hasRoll(row) ||
        ["rollNumber", "studentName", "teamName"].some((k) => String(row[k] ?? "").toLowerCase().includes(needle)),
    );
  const errorList = Array.from(rowErrors.entries());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[98vw] h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="p-3 sm:p-4 border-b flex flex-wrap justify-between items-center bg-slate-900 text-white shrink-0 gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white truncate">
              📋 Manage Responses & Results — {competition.title}
            </h2>
            <p className="text-xs text-slate-300">
              Excel থেকে paste করা যায়। শুধু বদলানো row সেভ হয়; একটিতেও ভুল থাকলে কিছুই সেভ হবে না। * চিহ্নিত ঘর বাধ্যতামূলক।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirtyCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-amber-400 text-slate-900 text-xs font-bold">
                {dirtyCount}টি অসংরক্ষিত পরিবর্তন
              </span>
            )}
            <button onClick={handleClose} className="px-4 py-2 border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold rounded-lg">
              বন্ধ করুন
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || dirtyCount === 0}
              className="px-5 py-2 bg-emerald-500 text-slate-950 font-black rounded-lg hover:bg-emerald-400 disabled:opacity-50 text-xs shadow-md transition"
            >
              {isSaving ? "সেভ হচ্ছে..." : "Save / Update Responses"}
            </button>
          </div>
        </div>

        <div className="bg-slate-100 px-3 sm:px-4 py-2 border-b border-slate-200 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                activeTab === tab
                  ? "bg-white text-emerald-800 border-emerald-300 shadow-sm"
                  : "bg-slate-200/70 text-slate-600 border-slate-300 hover:bg-slate-200"
              }`}
            >
              {tab === "team" ? "👥 Team-wise Responses" : "👤 Individual Responses"}
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                {counts[tab]}
              </span>
            </button>
          ))}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Roll / নাম / টিম খুঁজুন"
            className="sm:ml-auto w-full sm:w-64 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
          />
        </div>

        {errorList.length > 0 && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-800 max-h-28 overflow-auto shrink-0">
            <b>কিছুই সেভ হয়নি। নিচের row-গুলো ঠিক করুন:</b>
            <ul className="list-disc ml-5">
              {errorList.slice(0, 20).map(([key, msg]) => {
                const tab: Tab = grids.team.some((r) => r._key === key) ? "team" : "individual";
                const idx = grids[tab].findIndex((r) => r._key === key);
                return (
                  <li key={key}>
                    {tab === "team" ? "Team" : "Individual"} sheet, row {idx + 1}: {msg}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex-1 overflow-auto bg-slate-50">
          <table className="border-collapse bg-white shadow-sm whitespace-nowrap">
            <thead className="sticky top-0 z-20">
              <tr className={activeTab === "team" ? "bg-slate-900" : "bg-blue-950"}>
                <th className="sticky left-0 z-30 w-10 px-2 py-2 text-center text-xs font-bold text-white border border-slate-700 bg-slate-800">#</th>
                <th className="w-12 px-2 py-2 text-center text-xs font-bold text-white border border-slate-700">মুছুন</th>
                {activeColumns.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-left text-xs font-bold text-white border border-slate-700 min-w-[120px]">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, index }) => {
                const error = rowErrors.get(row._key);
                return (
                  <tr key={row._key} className={error ? "bg-red-50" : index % 2 === 0 ? "bg-white" : "bg-slate-50/80"} title={error}>
                    <td className={`sticky left-0 z-10 px-2 py-1 border border-slate-200 text-center text-xs font-mono font-semibold ${error ? "bg-red-200 text-red-900" : "bg-slate-100 text-slate-500"}`}>
                      {index + 1}
                    </td>
                    <td className="px-1 py-1 border border-slate-200 text-center">
                      <button type="button" onClick={() => handleDeleteRow(index)} title="Row মুছুন" className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs p-1 rounded transition">
                        🗑️
                      </button>
                    </td>
                    {activeColumns.map((col) => (
                      <td key={col.key} className={`border border-slate-200 p-0 ${isCellChanged(row, col.key) ? "bg-amber-50" : ""}`}>
                        <input
                          type="text"
                          inputMode={col.numeric ? "decimal" : undefined}
                          className={`w-full min-h-[32px] px-2 py-1 text-sm border-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 outline-none bg-transparent font-medium ${col.numeric ? "text-right tabular-nums" : ""}`}
                          value={row[col.key] ?? ""}
                          placeholder={col.type === "date" ? "YYYY-MM-DD" : undefined}
                          onChange={(e) => handleChange(index, col.key, e.target.value)}
                          onPaste={(e) => handlePaste(e, index, col.key)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
          <span className="text-xs text-slate-600 font-bold">
            {activeTab === "team" ? "Team-wise" : "Individual"} sheet — {counts[activeTab]}টি তথ্যসহ row
            {needle && ` (খোঁজার ফলে ${visible.filter((v) => hasRoll(v.row)).length}টি দেখানো হচ্ছে)`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleAddRow(1)} className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-xs shadow transition">
              ➕ নতুন row
            </button>
            <button type="button" onClick={() => handleAddRow(5)} className="px-3 py-1.5 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-800 text-xs shadow transition">
              ➕ ৫টি নতুন row
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
