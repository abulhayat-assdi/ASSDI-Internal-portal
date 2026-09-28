"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

interface LogRow {
    id: string;
    actionType: string;
    actorName: string | null;
    actorRole: "ADMIN" | "TEACHER";
    description: string;
    createdAt: string;
}

const ACTIONS: Record<string, { label: string; tone: string }> = {
    HOMEWORK_ASSIGNMENT_CREATED: { label: "ফোল্ডার তৈরি", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    HOMEWORK_ASSIGNMENT_UPDATED: { label: "ফোল্ডার এডিট", tone: "bg-amber-50 text-amber-700 border-amber-200" },
    HOMEWORK_ASSIGNMENT_DELETED: { label: "ফোল্ডার ডিলিট", tone: "bg-red-50 text-red-700 border-red-200" },
    HOMEWORK_ASSIGNMENT_SHARED: { label: "শেয়ার", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    HOMEWORK_ASSIGNMENT_UNSHARED: { label: "শেয়ার বন্ধ", tone: "bg-slate-100 text-slate-700 border-slate-200" },
    HOMEWORK_FOLDER_VIEWED: { label: "ফোল্ডার দেখা", tone: "bg-sky-50 text-sky-700 border-sky-200" },
    HOMEWORK_SUBMISSION_DELETED: { label: "জমা ডিলিট", tone: "bg-red-50 text-red-700 border-red-200" },
    HOMEWORK_BATCH_PURGED: { label: "ব্যাচ কমপ্লিট ক্লিনআপ", tone: "bg-purple-50 text-purple-700 border-purple-200" },
};

function formatWhen(iso: string): string {
    return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

export default function HomeworkLogPage() {
    const [logs, setLogs] = useState<LogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);

    const [action, setAction] = useState("");
    const [q, setQ] = useState("");
    const [search, setSearch] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page) });
            if (action) params.set("action", action);
            if (search) params.set("q", search);
            if (from) params.set("from", from);
            if (to) params.set("to", to);
            const res = await fetch(`/api/admin/homework-log?${params}`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "লগ লোড করা যায়নি।");
            setLogs(data.logs);
            setTotal(data.total);
            setPages(data.pages);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "লগ লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, [page, action, search, from, to]);

    useEffect(() => {
        load();
    }, [load]);

    // Any filter change starts again from the first page.
    const changeFilter = (fn: () => void) => {
        fn();
        setPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">📜 হোমওয়ার্ক লগ</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        কোন শিক্ষক কবে হোমওয়ার্ক ফোল্ডার তৈরি, এডিট, শেয়ার, ডিলিট করেছেন বা কী দেখেছেন — সব এখানে থাকে।
                    </p>
                </div>
                <Link
                    href="/dashboard/admin/manage-homework"
                    className="text-sm font-medium text-emerald-700 hover:underline"
                >
                    ← Manage Homework
                </Link>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">ধরন</label>
                    <select
                        value={action}
                        onChange={(e) => changeFilter(() => setAction(e.target.value))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                        <option value="">সব</option>
                        {Object.entries(ACTIONS).map(([key, a]) => (
                            <option key={key} value={key}>{a.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">শিক্ষক / কীওয়ার্ড</label>
                    <form onSubmit={(e) => { e.preventDefault(); changeFilter(() => setSearch(q.trim())); }}>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="নাম বা ফোল্ডারের নাম লিখে Enter"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </form>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">শুরুর তারিখ</label>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => changeFilter(() => setFrom(e.target.value))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">শেষ তারিখ</label>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => changeFilter(() => setTo(e.target.value))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-slate-400 text-sm">লোড হচ্ছে…</div>
                ) : logs.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">কোনো লগ পাওয়া যায়নি।</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {logs.map((l) => {
                            const meta = ACTIONS[l.actionType] ?? { label: l.actionType, tone: "bg-slate-100 text-slate-700 border-slate-200" };
                            return (
                                <li key={l.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                                    <div className="sm:w-44 shrink-0 text-xs text-slate-500">{formatWhen(l.createdAt)}</div>
                                    <div className="sm:w-40 shrink-0">
                                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.tone}`}>
                                            {meta.label}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-slate-800 break-words">{l.description}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {l.actorName ?? "Unknown"} · {l.actorRole === "TEACHER" ? "Teacher" : "Admin"}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500">
                <span>মোট {total} টি এন্ট্রি</span>
                <div className="flex items-center gap-2">
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                    >
                        আগের
                    </button>
                    <span>{page} / {pages}</span>
                    <button
                        disabled={page >= pages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                    >
                        পরের
                    </button>
                </div>
            </div>
        </div>
    );
}
