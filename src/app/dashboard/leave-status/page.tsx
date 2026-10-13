"use client";

import { useEffect, useMemo, useState } from "react";

type Leave = {
    id: string;
    studentName: string;
    studentRoll: string;
    studentPhone: string | null;
    studentBatchName: string;
    startDate: string;
    endDate: string;
    reason: string;
    totalLeaves: number;
    totalLeaveDays: number;
};

type Batch = { id: string; name: string; status?: string };

/** Local-time YYYY-MM-DD (toISOString would shift the day for UTC+6). */
function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}

function fmt(date: string) {
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) return date;
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function dayCount(start: string, end: string) {
    const s = new Date(start + "T00:00:00").getTime();
    const e = new Date(end + "T00:00:00").getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return null;
    return Math.round((e - s) / 86400000) + 1;
}

export default function LeaveStatusPage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [batchesLoaded, setBatchesLoaded] = useState(false);
    const [batch, setBatch] = useState("ALL");
    const [from, setFrom] = useState(todayISO);
    const [to, setTo] = useState(todayISO);
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch("/api/schedule/batches")
            .then((r) => (r.ok ? r.json() : []))
            // Only running batches — completed ones are archived.
            .then((data: Batch[]) => Array.isArray(data) && setBatches(data.filter((b) => b.status !== "archived")))
            .catch(() => {})
            .finally(() => setBatchesLoaded(true));
    }, []);

    useEffect(() => {
        if (!from || !to || !batchesLoaded) return;
        if (from > to) {
            setError("From date cannot be after To date.");
            return;
        }
        const ctrl = new AbortController();
        setLoading(true);
        setError("");
        const qs = new URLSearchParams({ from, to });
        // "All batches" means all *running* batches; a chosen batch narrows to that one.
        if (batch !== "ALL") qs.append("batch", batch);
        else batches.forEach((b) => qs.append("batch", b.name));
        fetch(`/api/leave-status?${qs}`, { signal: ctrl.signal })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || "Failed to load leave status");
                setLeaves(data.leaves);
            })
            .catch((e) => {
                if (e.name !== "AbortError") setError(e.message || "Failed to load leave status");
            })
            .finally(() => !ctrl.signal.aborted && setLoading(false));
        return () => ctrl.abort();
    }, [batch, from, to, batches, batchesLoaded]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return leaves;
        return leaves.filter(
            (l) =>
                l.studentName.toLowerCase().includes(q) ||
                l.studentRoll.toLowerCase().includes(q) ||
                (l.studentPhone || "").includes(q)
        );
    }, [leaves, search]);

    const today = todayISO();
    const rangeLabel = from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Who&apos;s on Leave</h1>
                <p className="text-sm text-slate-500 mt-1">
                    Students on approved leave for the selected batch and dates.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
                <label className="block text-sm">
                    <span className="block text-slate-600 mb-1">Batch</span>
                    <select
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                        <option value="ALL">All running batches</option>
                        {batches.map((b) => (
                            <option key={b.id} value={b.name}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block text-sm">
                    <span className="block text-slate-600 mb-1">From</span>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => {
                            setFrom(e.target.value);
                            if (e.target.value > to) setTo(e.target.value);
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                </label>
                <label className="block text-sm">
                    <span className="block text-slate-600 mb-1">To</span>
                    <input
                        type="date"
                        value={to}
                        min={from}
                        onChange={(e) => setTo(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                </label>
                <label className="block text-sm lg:col-span-2">
                    <span className="block text-slate-600 mb-1">Search</span>
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Name, roll or mobile"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                </label>
                <div className="sm:col-span-2 lg:col-span-5 flex items-center gap-2 text-sm">
                    <button
                        type="button"
                        onClick={() => {
                            setFrom(today);
                            setTo(today);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
                    >
                        Today
                    </button>
                    <span className="text-slate-500">
                        Showing <strong className="text-slate-800">{rangeLabel}</strong>
                        {batch !== "ALL" && <> · {batch}</>}
                    </span>
                </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                    {loading ? "Loading…" : `${visible.length} student${visible.length === 1 ? "" : "s"} on leave`}
                </div>

                {!loading && visible.length === 0 && !error && (
                    <div className="px-4 py-12 text-center text-slate-500 text-sm">
                        No one is on leave for this selection.
                    </div>
                )}

                {visible.length > 0 && (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-slate-600">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">Student</th>
                                        <th className="px-4 py-2 font-medium">Mobile</th>
                                        <th className="px-4 py-2 font-medium">Leave dates</th>
                                        <th className="px-4 py-2 font-medium">Reason</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {visible.map((l) => (
                                        <tr key={l.id} className="align-top">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{l.studentName}</div>
                                                <div className="text-xs text-slate-500">
                                                    {l.studentBatchName} · Roll {l.studentRoll}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    Total: {l.totalLeaves} leave{l.totalLeaves === 1 ? "" : "s"} · {l.totalLeaveDays} day(s)
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {l.studentPhone ? (
                                                    <a href={`tel:${l.studentPhone}`} className="text-blue-600 hover:underline">
                                                        {l.studentPhone}
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {fmt(l.startDate)} – {fmt(l.endDate)}
                                                <div className="text-xs text-slate-500">{dayCount(l.startDate, l.endDate)} day(s)</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 max-w-md whitespace-pre-wrap break-words">{l.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <ul className="md:hidden divide-y divide-slate-100">
                            {visible.map((l) => (
                                <li key={l.id} className="p-4 space-y-1.5 text-sm">
                                    <div className="font-medium text-slate-900">{l.studentName}</div>
                                    <div className="text-xs text-slate-500">
                                        {l.studentBatchName} · Roll {l.studentRoll}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Total: {l.totalLeaves} leave{l.totalLeaves === 1 ? "" : "s"} · {l.totalLeaveDays} day(s)
                                    </div>
                                    {l.studentPhone && (
                                        <a href={`tel:${l.studentPhone}`} className="block text-blue-600">
                                            {l.studentPhone}
                                        </a>
                                    )}
                                    <div>
                                        {fmt(l.startDate)} – {fmt(l.endDate)}
                                    </div>
                                    <div className="text-slate-700 whitespace-pre-wrap break-words">{l.reason}</div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
}
