"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { exportRowsToXlsx } from "@/lib/exportRows";
import { dhakaDate, formatClock, formatDuration } from "@/lib/teacherClassLog";

interface Batch {
    id: string;
    name: string;
    status?: "active" | "archived";
}

interface TeacherRow {
    teacherUid: string;
    teacherName: string;
    classes: number;
    totalMinutes: number;
    activeDays: number;
}

interface Totals {
    teachers: number;
    classes: number;
    totalMinutes: number;
}

interface ClassLog {
    id: string;
    teacherName: string;
    batchName: string;
    subjectName: string;
    date: string;
    topic: string;
    startTime: string;
    endTime: string;
    durationMin: number;
    enteredByAdmin: boolean;
    enteredByName: string;
}

const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

const monthStart = () => `${dhakaDate().slice(0, 8)}01`;

export default function TeacherClassReportPage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [teachers, setTeachers] = useState<{ id: string; displayName: string }[]>([]);
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);

    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(dhakaDate());
    const [teacherUid, setTeacherUid] = useState("");
    const [subjectId, setSubjectId] = useState("");
    const [batchName, setBatchName] = useState("");
    // The full class list is collapsed until asked for.
    const [showDetails, setShowDetails] = useState(false);

    const [rows, setRows] = useState<TeacherRow[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [logs, setLogs] = useState<ClassLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/schedule/batches")
            .then((r) => r.json())
            .then((d) => Array.isArray(d) && setBatches(d))
            .catch(() => undefined);
        fetch("/api/teaching-subjects")
            .then((r) => r.json())
            .then((d) => {
                if (Array.isArray(d.subjects)) setSubjects(d.subjects);
                if (Array.isArray(d.teachers)) setTeachers(d.teachers);
            })
            .catch(() => undefined);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ from, to });
            if (teacherUid) params.set("teacherUid", teacherUid);
            if (subjectId) params.set("subjectId", subjectId);
            if (batchName) params.set("batchName", batchName);

            const [summaryRes, logsRes] = await Promise.all([
                fetch(`/api/teacher-class-logs/summary?${params}`),
                fetch(`/api/teacher-class-logs?${params}`),
            ]);
            const summary = await summaryRes.json();
            const list = await logsRes.json();
            if (!summaryRes.ok) throw new Error(summary.error || "রিপোর্ট লোড করা যায়নি।");
            if (!logsRes.ok) throw new Error(list.error || "রিপোর্ট লোড করা যায়নি।");
            setRows(summary.teachers);
            setTotals(summary.totals);
            setLogs(list.logs);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "রিপোর্ট লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, [from, to, teacherUid, subjectId, batchName]);

    useEffect(() => {
        load();
    }, [load]);

    const exportSummary = async () => {
        if (!rows.length) return toast.error("এক্সপোর্ট করার মতো কিছু নেই।");
        await exportRowsToXlsx({
            fileName: `teacher-class-summary-${from}_${to}`,
            sheetName: "Summary",
            rows: rows.map((r) => ({
                Teacher: r.teacherName,
                Classes: r.classes,
                "Active Days": r.activeDays,
                "Total Minutes": r.totalMinutes,
                "Total Time": formatDuration(r.totalMinutes),
            })),
        });
    };

    const exportDetails = async () => {
        if (!logs.length) return toast.error("এক্সপোর্ট করার মতো কিছু নেই।");
        await exportRowsToXlsx({
            fileName: `teacher-classes-${from}_${to}`,
            sheetName: "Classes",
            rows: logs.map((l) => ({
                Date: l.date,
                Teacher: l.teacherName,
                Batch: l.batchName,
                Subject: l.subjectName,
                "Class Topic": l.topic,
                "Start Time": l.startTime,
                "End Time": l.endTime,
                "Duration (min)": l.durationMin,
                "Entered By": l.enteredByAdmin ? `${l.enteredByName} (admin)` : "Teacher",
            })),
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Teacher Class Report</h1>
                <p className="text-slate-500 text-sm mt-1">কোন শিক্ষক কতগুলো ক্লাস নিয়েছেন এবং মোট কতক্ষণ।</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">From</label>
                    <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">To</label>
                    <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">শিক্ষক</label>
                    <select value={teacherUid} onChange={(e) => setTeacherUid(e.target.value)} className={inputCls}>
                        <option value="">সব শিক্ষক</option>
                        {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.displayName}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">বিষয়</label>
                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                        <option value="">সব বিষয়</option>
                        {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">ব্যাচ</label>
                    <select value={batchName} onChange={(e) => setBatchName(e.target.value)} className={inputCls}>
                        <option value="">সব ব্যাচ</option>
                        {batches.map((b) => (
                            <option key={b.id} value={b.name}>
                                {b.name}
                                {b.status === "archived" ? " (completed)" : ""}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Totals */}
            {totals && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "শিক্ষক", value: totals.teachers },
                        { label: "মোট ক্লাস", value: totals.classes },
                        { label: "মোট সময়", value: formatDuration(totals.totalMinutes) },
                    ].map((t) => (
                        <div key={t.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                            <p className="text-xs text-slate-500">{t.label}</p>
                            <p className="text-2xl font-bold text-slate-800 mt-1">{t.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Per teacher */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-700">শিক্ষকভিত্তিক সারসংক্ষেপ</p>
                    <button onClick={exportSummary} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                        Export Excel
                    </button>
                </div>
                {loading ? (
                    <div className="p-10 text-center text-slate-400 text-sm">লোড হচ্ছে...</div>
                ) : rows.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">এই সময়ে কোনো ক্লাসের রেকর্ড নেই।</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs">
                                <tr>
                                    <th className="text-left font-medium px-4 py-2">Teacher</th>
                                    <th className="text-right font-medium px-4 py-2">Classes</th>
                                    <th className="text-right font-medium px-4 py-2">Active Days</th>
                                    <th className="text-right font-medium px-4 py-2">Total Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map((r) => (
                                    <tr key={r.teacherUid}>
                                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.teacherName}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-700">{r.classes}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-700">{r.activeDays}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-700">{formatDuration(r.totalMinutes)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Every class */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <button
                        onClick={() => setShowDetails((v) => !v)}
                        className="text-sm font-semibold text-slate-700 hover:text-emerald-700"
                    >
                        ক্লাসের বিস্তারিত ({logs.length}) {showDetails ? "▲" : "▼"}
                    </button>
                    <button onClick={exportDetails} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                        Export Excel
                    </button>
                </div>
                {showDetails && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs">
                                <tr>
                                    <th className="text-left font-medium px-4 py-2">Date</th>
                                    <th className="text-left font-medium px-4 py-2">Teacher</th>
                                    <th className="text-left font-medium px-4 py-2">Batch</th>
                                    <th className="text-left font-medium px-4 py-2">Subject</th>
                                    <th className="text-left font-medium px-4 py-2">Class Topic</th>
                                    <th className="text-left font-medium px-4 py-2">Time</th>
                                    <th className="text-left font-medium px-4 py-2">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.map((l) => (
                                    <tr key={l.id} className="align-top">
                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{l.date}</td>
                                        <td className="px-4 py-2.5 text-slate-700">
                                            {l.teacherName}
                                            {l.enteredByAdmin && (
                                                <span
                                                    title={`${l.enteredByName} দ্বারা এন্ট্রি`}
                                                    className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                                                >
                                                    Admin entry
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{l.batchName}</td>
                                        <td className="px-4 py-2.5 text-slate-700">{l.subjectName}</td>
                                        <td className="px-4 py-2.5 text-slate-600">{l.topic}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                                            {formatClock(l.startTime)} – {formatClock(l.endTime)}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDuration(l.durationMin)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
