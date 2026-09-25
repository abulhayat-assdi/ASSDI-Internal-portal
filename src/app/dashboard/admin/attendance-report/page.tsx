"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { exportRowsToXlsx } from "@/lib/exportRows";
import { LOW_ATTENDANCE_THRESHOLD, today as todayStr } from "@/lib/attendance";

interface Batch {
    id: string;
    name: string;
}

interface Summary {
    studentId: string;
    roll: string;
    name: string;
    batchName: string;
    tally: {
        present: number;
        absent: number;
        late: number;
        excused: number;
        counted: number;
        attended: number;
        percentage: number | null;
    };
    low: boolean;
}

interface Totals {
    sessions: number;
    students: number;
    lowCount: number;
    courseAverage: number | null;
}

/** First day of the current month — a sensible default window. */
function monthStart(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function AttendanceReportPage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [batchName, setBatchName] = useState("ALL");
    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(todayStr());
    const [threshold, setThreshold] = useState(LOW_ATTENDANCE_THRESHOLD);
    const [onlyLow, setOnlyLow] = useState(false);

    const [summaries, setSummaries] = useState<Summary[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/schedule/batches")
            .then((r) => r.json())
            .then((d) => Array.isArray(d) && setBatches(d))
            .catch(() => undefined);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ from, to, threshold: String(threshold) });
            if (batchName !== "ALL") params.set("batchName", batchName);
            const res = await fetch(`/api/attendance/summary?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "রিপোর্ট লোড করা যায়নি।");
            setSummaries(data.summaries);
            setTotals(data.totals);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "রিপোর্ট লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, [batchName, from, to, threshold]);

    useEffect(() => {
        load();
    }, [load]);

    const rows = onlyLow ? summaries.filter((s) => s.low) : summaries;

    const exportXlsx = () => {
        if (!rows.length) {
            toast.error("এক্সপোর্ট করার মতো কিছু নেই।");
            return;
        }
        exportRowsToXlsx({
            fileName: `attendance-${batchName === "ALL" ? "all-batches" : batchName}-${from}_${to}`,
            sheetName: "Attendance",
            rows: rows.map((s) => ({
                Batch: s.batchName,
                Roll: s.roll,
                Name: s.name,
                Present: s.tally.present,
                Late: s.tally.late,
                Absent: s.tally.absent,
                Excused: s.tally.excused,
                "Counted Classes": s.tally.counted,
                "Attendance %": s.tally.percentage ?? "",
                "Below Threshold": s.low ? "YES" : "",
            })),
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">অ্যাটেনডেন্স রিপোর্ট</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        ব্যাচ ও তারিখ অনুযায়ী উপস্থিতির হার। দেরিতে আসা উপস্থিত হিসেবে গোনা হয়; মঞ্জুর করা
                        ছুটি হিসাবের বাইরে থাকে।
                    </p>
                </div>
                <button
                    onClick={exportXlsx}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
                >
                    Excel ডাউনলোড
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">ব্যাচ</label>
                    <select
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="ALL">সব ব্যাচ</option>
                        {batches.map((b) => (
                            <option key={b.id} value={b.name}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">শুরু</label>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">শেষ</label>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">থ্রেশহোল্ড (%)</label>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value) || LOW_ATTENDANCE_THRESHOLD)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                </div>
            </div>

            {/* Totals */}
            {totals && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Stat label="মোট রোল কল" value={totals.sessions} />
                    <Stat label="ছাত্র" value={totals.students} />
                    <Stat
                        label="গড় উপস্থিতি"
                        value={totals.courseAverage === null ? "—" : `${totals.courseAverage}%`}
                    />
                    <Stat
                        label={`${threshold}%-এর নিচে`}
                        value={totals.lowCount}
                        tone={totals.lowCount > 0 ? "warn" : "normal"}
                    />
                </div>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                    type="checkbox"
                    checked={onlyLow}
                    onChange={(e) => setOnlyLow(e.target.checked)}
                    className="rounded border-slate-300"
                />
                শুধু থ্রেশহোল্ডের নিচের ছাত্রদের দেখাও
            </label>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
                {loading ? (
                    <div className="p-10 text-center text-slate-400 text-sm">লোড হচ্ছে...</div>
                ) : rows.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">কোনো তথ্য নেই।</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                            <tr>
                                <th className="text-left px-4 py-3">ব্যাচ</th>
                                <th className="text-left px-4 py-3">রোল</th>
                                <th className="text-left px-4 py-3">নাম</th>
                                <th className="text-right px-4 py-3">উপস্থিত</th>
                                <th className="text-right px-4 py-3">দেরিতে</th>
                                <th className="text-right px-4 py-3">অনুপস্থিত</th>
                                <th className="text-right px-4 py-3">ছুটি</th>
                                <th className="text-right px-4 py-3">হার</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((s) => (
                                <tr key={s.studentId} className={s.low ? "bg-red-50/60" : undefined}>
                                    <td className="px-4 py-2.5 text-slate-500">{s.batchName}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.roll}</td>
                                    <td className="px-4 py-2.5 font-medium text-slate-700">{s.name}</td>
                                    <td className="px-4 py-2.5 text-right">{s.tally.present}</td>
                                    <td className="px-4 py-2.5 text-right">{s.tally.late}</td>
                                    <td className="px-4 py-2.5 text-right">{s.tally.absent}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-400">{s.tally.excused}</td>
                                    <td
                                        className={`px-4 py-2.5 text-right font-semibold ${
                                            s.low ? "text-red-600" : "text-slate-700"
                                        }`}
                                    >
                                        {s.tally.percentage === null ? "—" : `${s.tally.percentage}%`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function Stat({
    label,
    value,
    tone = "normal",
}: {
    label: string;
    value: string | number;
    tone?: "normal" | "warn";
}) {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{label}</p>
            <p
                className={`text-2xl font-bold mt-1 ${
                    tone === "warn" ? "text-red-600" : "text-slate-800"
                }`}
            >
                {value}
            </p>
        </div>
    );
}
