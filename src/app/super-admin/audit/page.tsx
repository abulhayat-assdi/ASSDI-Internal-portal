"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";

interface AuditLog {
    id: string;
    courseId: string;
    actorUid: string;
    actorRole: string;
    actionType: string;
    targetType: string;
    targetId: string;
    description: string;
    createdAt: string;
}

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [courses, setCourses] = useState<Record<string, { slug: string; name: string }>>({});
    const [actionTypes, setActionTypes] = useState<string[]>([]);
    const [courseId, setCourseId] = useState("");
    const [actionType, setActionType] = useState("");
    const [q, setQ] = useState("");
    const [qInput, setQInput] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const sp = new URLSearchParams({ page: String(page) });
        if (courseId) sp.set("courseId", courseId);
        if (actionType) sp.set("actionType", actionType);
        if (q) sp.set("q", q);
        try {
            const res = await fetch(`/api/saas/audit?${sp}`);
            const d = await res.json();
            if (res.ok) {
                setLogs(d.logs || []);
                setTotal(d.total || 0);
                setPages(d.pages || 1);
                setCourses(d.courses || {});
                setActionTypes(d.actionTypes || []);
            }
        } finally {
            setLoading(false);
        }
    }, [page, courseId, actionType, q]);

    useEffect(() => { load(); }, [load]);

    const resetPage = (fn: () => void) => { setPage(1); fn(); };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <Link href="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" />
                সব কোর্স
            </Link>
            <div className="flex items-center gap-2 mb-1">
                <ScrollText className="w-5 h-5 text-indigo-600" />
                <h1 className="text-xl font-bold text-slate-800">Audit Log</h1>
            </div>
            <p className="text-sm text-slate-500 mb-5">সব কোর্সের অ্যাকশন — impersonation, billing, অ্যাডমিন পরিবর্তনসহ ({total}টি এন্ট্রি)</p>

            <div className="bg-white rounded-xl border border-slate-100 p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select value={courseId} onChange={(e) => resetPage(() => setCourseId(e.target.value))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">সব কোর্স</option>
                    {Object.entries(courses).map(([id, c]) => (
                        <option key={id} value={id}>{c.name} ({c.slug})</option>
                    ))}
                </select>
                <select value={actionType} onChange={(e) => resetPage(() => setActionType(e.target.value))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">সব অ্যাকশন</option>
                    {actionTypes.map((a) => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>
                <form
                    className="sm:col-span-2 flex gap-2"
                    onSubmit={(e) => { e.preventDefault(); resetPage(() => setQ(qInput)); }}
                >
                    <input
                        value={qInput}
                        onChange={(e) => setQInput(e.target.value)}
                        placeholder="সার্চ — email, বিবরণ, ID…"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <button type="submit" className="bg-slate-800 text-white text-sm font-medium px-4 rounded-lg hover:bg-slate-900">খুঁজুন</button>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">লোড হচ্ছে...</div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">কোনো লগ পাওয়া যায়নি।</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-100">
                                    <th className="px-4 py-3 font-medium">সময়</th>
                                    <th className="px-4 py-3 font-medium">কোর্স</th>
                                    <th className="px-4 py-3 font-medium">অ্যাকশন</th>
                                    <th className="px-4 py-3 font-medium">বিবরণ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((l) => (
                                    <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 align-top">
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                                            {new Date(l.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{courses[l.courseId]?.name || l.courseId.slice(0, 8)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{l.actionType}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 text-xs">{l.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {pages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-100 text-sm">
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40">আগে</button>
                        <span className="text-slate-500">{page} / {pages}</span>
                        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40">পরে</button>
                    </div>
                )}
            </div>
        </div>
    );
}
