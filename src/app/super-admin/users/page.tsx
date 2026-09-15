"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Ban, CheckCircle, KeyRound } from "lucide-react";

interface SaaSUser {
    id: string;
    email: string;
    displayName: string;
    role: string;
    courseId: string | null;
    studentBatchName: string | null;
    studentRoll: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    deletedAt: string | null;
}

export default function UsersPage() {
    const [users, setUsers] = useState<SaaSUser[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [courses, setCourses] = useState<Record<string, { slug: string; name: string }>>({});
    const [email, setEmail] = useState("");
    const [emailInput, setEmailInput] = useState("");
    const [role, setRole] = useState("");
    const [courseId, setCourseId] = useState("");
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        const sp = new URLSearchParams({ page: String(page) });
        if (email) sp.set("email", email);
        if (role) sp.set("role", role);
        if (courseId) sp.set("courseId", courseId);
        if (includeDeleted) sp.set("includeDeleted", "1");
        try {
            const res = await fetch(`/api/saas/users?${sp}`);
            const d = await res.json();
            if (res.ok) {
                setUsers(d.users || []);
                setTotal(d.total || 0);
                setPages(d.pages || 1);
                setCourses(d.courses || {});
            }
        } finally {
            setLoading(false);
        }
    }, [page, email, role, courseId, includeDeleted]);

    useEffect(() => { load(); }, [load]);

    const act = async (id: string, action: "password" | "disable" | "enable") => {
        setMsg(""); setErr("");
        try {
            if (action === "password") {
                const np = prompt("নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর):");
                if (!np) return;
                const res = await fetch(`/api/saas/users/${id}/password`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newPassword: np }),
                });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error || "ব্যর্থ হয়েছে।");
                setMsg(`${d.email}-এর পাসওয়ার্ড বদলে গেছে।`);
            } else {
                const disabled = action === "disable";
                if (!confirm(`এই ইউজারকে ${disabled ? "disable" : "আবার চালু"} করতে চান?`)) return;
                const res = await fetch(`/api/saas/users/${id}/status`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ disabled }),
                });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error || "ব্যর্থ হয়েছে।");
                setMsg(`${d.email} ${disabled ? "disable" : "re-enable"} হয়েছে।`);
                load();
            }
        } catch (e) {
            setErr(e instanceof Error ? e.message : "ব্যর্থ হয়েছে।");
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <Link href="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" />
                সব কোর্স
            </Link>
            <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-indigo-600" />
                <h1 className="text-xl font-bold text-slate-800">Global Users</h1>
            </div>
            <p className="text-sm text-slate-500 mb-5">সব কোর্স মিলিয়ে ইউজার খুঁজুন, পাসওয়ার্ড রিসেট বা অ্যাকাউন্ট disable/enable করুন ({total} জন)</p>

            {err && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{err}</div>}
            {msg && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">{msg}</div>}

            <form
                className="bg-white rounded-xl border border-slate-100 p-4 mb-4 grid grid-cols-1 sm:grid-cols-5 gap-3"
                onSubmit={(e) => { e.preventDefault(); setPage(1); setEmail(emailInput); }}
            >
                <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="ইমেইল দিয়ে খুঁজুন…" className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <select value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">সব রোল</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                    <option value="super_admin">Super Admin</option>
                </select>
                <select value={courseId} onChange={(e) => { setPage(1); setCourseId(e.target.value); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">সব কোর্স</option>
                    {Object.entries(courses).map(([id, c]) => (
                        <option key={id} value={id}>{c.name}</option>
                    ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={includeDeleted} onChange={(e) => { setPage(1); setIncludeDeleted(e.target.checked); }} className="rounded" />
                    Disabled-সহ
                </label>
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">লোড হচ্ছে...</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">কেউ পাওয়া যায়নি।</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-100">
                                    <th className="px-4 py-3 font-medium">ইউজার</th>
                                    <th className="px-4 py-3 font-medium">রোল</th>
                                    <th className="px-4 py-3 font-medium">কোর্স</th>
                                    <th className="px-4 py-3 font-medium">শেষ লগইন</th>
                                    <th className="px-4 py-3 font-medium text-right">অ্যাকশন</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50 ${u.deletedAt ? "opacity-60" : ""}`}>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-800">{u.displayName} {u.deletedAt && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">disabled</span>}</p>
                                            <p className="text-xs text-slate-500">{u.email}{u.studentBatchName ? ` · ${u.studentBatchName}${u.studentRoll ? ` (${u.studentRoll})` : ""}` : ""}</p>
                                        </td>
                                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{u.role}</span></td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{u.courseId ? courses[u.courseId]?.name || "—" : "—"}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            {u.role !== "super_admin" && (
                                                <>
                                                    <button onClick={() => act(u.id, "password")} title="পাসওয়ার্ড রিসেট" className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><KeyRound className="w-4 h-4" /></button>
                                                    {u.deletedAt ? (
                                                        <button onClick={() => act(u.id, "enable")} title="আবার চালু করুন" className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle className="w-4 h-4" /></button>
                                                    ) : (
                                                        <button onClick={() => act(u.id, "disable")} title="Disable" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Ban className="w-4 h-4" /></button>
                                                    )}
                                                </>
                                            )}
                                        </td>
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
