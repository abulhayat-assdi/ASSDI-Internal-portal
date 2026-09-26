"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { exportRowsToXlsx, exportRowsToCsv } from "@/lib/exportRows";
import { LOW_ATTENDANCE_THRESHOLD, today as todayStr } from "@/lib/attendance";

interface Batch {
    id: string;
    name: string;
}

interface StudentRow {
    roll: string;
    name: string;
    batchName: string;
    phone: string;
    attendance: { present: number; absent: number; late: number; excused: number; counted: number; percentage: number | null };
    homeworkCount: number;
    lastHomeworkDate: string | null;
    examAverage: number | null;
    examCount: number;
    risks: string[];
}

interface BatchRow {
    batchName: string;
    students: number;
    attendanceAverage: number | null;
    homeworkSubmissions: number;
    examAverage: number | null;
    atRisk: number;
}

interface Overview {
    threshold: number;
    totals: {
        students: number;
        batches: number;
        sessions: number;
        attendanceAverage: number | null;
        homeworkSubmissions: number;
        examAverage: number | null;
        atRisk: number;
        withoutLogin: number;
    };
    batches: BatchRow[];
    students: StudentRow[];
}

function monthStart(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export default function ReportsPage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [batchName, setBatchName] = useState("ALL");
    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(todayStr());
    const [threshold, setThreshold] = useState(LOW_ATTENDANCE_THRESHOLD);

    const [data, setData] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"batches" | "risk" | "students">("batches");

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
            const res = await fetch(`/api/reports/overview?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "রিপোর্ট লোড করা যায়নি।");
            setData(json);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "রিপোর্ট লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, [batchName, from, to, threshold]);

    useEffect(() => {
        load();
    }, [load]);

    const studentRows = () =>
        (data?.students ?? []).map((s) => ({
            Batch: s.batchName,
            Roll: s.roll,
            Name: s.name,
            Phone: s.phone,
            "Attendance %": s.attendance.percentage ?? "",
            Present: s.attendance.present,
            Late: s.attendance.late,
            Absent: s.attendance.absent,
            "Homework Submitted": s.homeworkCount,
            "Last Homework": s.lastHomeworkDate ?? "",
            "Exam Avg %": s.examAverage ?? "",
            "Exams Taken": s.examCount,
            Risks: s.risks.join("; "),
        }));

    const download = async (kind: "xlsx" | "csv") => {
        const rows = studentRows();
        if (!rows.length) {
            toast.error("এক্সপোর্ট করার মতো কিছু নেই।");
            return;
        }
        const fileName = `report-${batchName === "ALL" ? "all-batches" : batchName}-${from}_${to}`;
        if (kind === "xlsx") await exportRowsToXlsx({ fileName, sheetName: "Students", rows });
        else exportRowsToCsv({ fileName, rows });
    };

    const atRisk = (data?.students ?? []).filter((s) => s.risks.length > 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">রিপোর্ট ও ইনসাইট</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        উপস্থিতি, হোমওয়ার্ক আর পরীক্ষার ফল — এক জায়গায়, ব্যাচ ও তারিখ অনুযায়ী।
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => download("xlsx")}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
                    >
                        Excel
                    </button>
                    <button
                        onClick={() => download("csv")}
                        className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                    >
                        CSV
                    </button>
                </div>
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
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">শেষ</label>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">উপস্থিতি থ্রেশহোল্ড (%)</label>
                    <input type="number" min={1} max={100} value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value) || LOW_ATTENDANCE_THRESHOLD)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
            </div>

            {/* Headline numbers */}
            {data && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <Stat label="ছাত্র" value={data.totals.students} />
                    <Stat label="গড় উপস্থিতি" value={pct(data.totals.attendanceAverage)} />
                    <Stat label="হোমওয়ার্ক জমা" value={data.totals.homeworkSubmissions} />
                    <Stat label="পরীক্ষার গড়" value={pct(data.totals.examAverage)} />
                    <Stat label="ঝুঁকিতে" value={data.totals.atRisk} tone={data.totals.atRisk ? "warn" : "normal"} />
                    <Stat
                        label="লগইন নেই"
                        value={data.totals.withoutLogin}
                        tone={data.totals.withoutLogin ? "warn" : "normal"}
                    />
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                {([
                    ["batches", "ব্যাচভিত্তিক"],
                    ["risk", `ঝুঁকিতে থাকা ছাত্র (${atRisk.length})`],
                    ["students", "সব ছাত্র"],
                ] as const).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === key
                                ? "border-emerald-600 text-emerald-700"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="p-10 text-center text-slate-400 text-sm">লোড হচ্ছে...</div>
            ) : !data ? (
                <div className="p-10 text-center text-slate-400 text-sm">তথ্য নেই।</div>
            ) : tab === "batches" ? (
                <Table
                    headers={["ব্যাচ", "ছাত্র", "গড় উপস্থিতি", "হোমওয়ার্ক", "পরীক্ষার গড়", "ঝুঁকিতে"]}
                    empty={data.batches.length === 0}
                >
                    {data.batches.map((b) => (
                        <tr key={b.batchName}>
                            <td className="px-4 py-2.5 font-medium text-slate-700">{b.batchName}</td>
                            <td className="px-4 py-2.5 text-right">{b.students}</td>
                            <td className="px-4 py-2.5 text-right">{pct(b.attendanceAverage)}</td>
                            <td className="px-4 py-2.5 text-right">{b.homeworkSubmissions}</td>
                            <td className="px-4 py-2.5 text-right">{pct(b.examAverage)}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${b.atRisk ? "text-red-600" : "text-slate-400"}`}>
                                {b.atRisk}
                            </td>
                        </tr>
                    ))}
                </Table>
            ) : tab === "risk" ? (
                <Table
                    headers={["ব্যাচ", "রোল", "নাম", "ফোন", "কারণ"]}
                    empty={atRisk.length === 0}
                    emptyText="কেউ ঝুঁকিতে নেই — চমৎকার!"
                >
                    {atRisk.map((s) => (
                        <tr key={`${s.batchName}-${s.roll}`} className="bg-red-50/40">
                            <td className="px-4 py-2.5 text-slate-500">{s.batchName}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.roll}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-700">{s.name}</td>
                            <td className="px-4 py-2.5 text-slate-500">{s.phone || "—"}</td>
                            <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1.5">
                                    {s.risks.map((r) => (
                                        <span key={r} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            ) : (
                <Table
                    headers={["ব্যাচ", "রোল", "নাম", "উপস্থিতি", "হোমওয়ার্ক", "শেষ জমা", "পরীক্ষার গড়"]}
                    empty={data.students.length === 0}
                >
                    {data.students.map((s) => (
                        <tr key={`${s.batchName}-${s.roll}`}>
                            <td className="px-4 py-2.5 text-slate-500">{s.batchName}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.roll}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-700">{s.name}</td>
                            <td className="px-4 py-2.5 text-right">{pct(s.attendance.percentage)}</td>
                            <td className="px-4 py-2.5 text-right">{s.homeworkCount}</td>
                            <td className="px-4 py-2.5 text-right text-slate-500">{s.lastHomeworkDate ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right">{pct(s.examAverage)}</td>
                        </tr>
                    ))}
                </Table>
            )}
        </div>
    );
}

function Stat({ label, value, tone = "normal" }: { label: string; value: string | number; tone?: "normal" | "warn" }) {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${tone === "warn" ? "text-red-600" : "text-slate-800"}`}>{value}</p>
        </div>
    );
}

function Table({
    headers,
    children,
    empty,
    emptyText = "কোনো তথ্য নেই।",
}: {
    headers: string[];
    children: React.ReactNode;
    empty: boolean;
    emptyText?: string;
}) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
            {empty ? (
                <div className="p-10 text-center text-slate-400 text-sm">{emptyText}</div>
            ) : (
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                        <tr>
                            {headers.map((h, i) => (
                                <th key={h} className={i === 0 || i === 2 ? "text-left px-4 py-3" : "text-right px-4 py-3"}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">{children}</tbody>
                </table>
            )}
        </div>
    );
}
