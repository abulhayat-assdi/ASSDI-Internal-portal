"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, LogOut, KeyRound, Loader2 } from "lucide-react";

interface SuperAdmin {
    id: string;
    email: string;
    displayName: string;
    lastLoginAt: string | null;
    createdAt: string;
    sessionActive: boolean;
    activeSession: { expiresAt: string; createdAt: string } | null;
}

export default function SecurityPage() {
    const [admins, setAdmins] = useState<SuperAdmin[]>([]);
    const [selfId, setSelfId] = useState("");
    const [cur, setCur] = useState("");
    const [next, setNext] = useState("");
    const [changing, setChanging] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        const res = await fetch("/api/saas/security/sessions");
        const d = await res.json();
        if (res.ok) { setAdmins(d.admins || []); setSelfId(d.selfId || ""); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const revoke = async (userId: string, email: string) => {
        if (!confirm(`${email}-এর সব সেশন বন্ধ করতে চান? তিনি সাথে সাথে logout হয়ে যাবেন।`)) return;
        setErr(""); setMsg("");
        const res = await fetch(`/api/saas/security/sessions?userId=${userId}`, { method: "DELETE" });
        const d = await res.json();
        if (!res.ok) setErr(d.error || "ব্যর্থ হয়েছে।");
        else { setMsg(`${email}-এর সেশন revoke হয়েছে।`); load(); }
    };

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr(""); setMsg("");
        setChanging(true);
        try {
            const res = await fetch("/api/saas/security/password", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: cur, newPassword: next }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || "ব্যর্থ হয়েছে।");
            setMsg("পাসওয়ার্ড বদলে গেছে।");
            setCur(""); setNext("");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "ব্যর্থ হয়েছে।");
        } finally {
            setChanging(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <Link href="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-4 h-4" />
                সব কোর্স
            </Link>
            <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h1 className="text-xl font-bold text-slate-800">Security</h1>
            </div>

            {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{err}</div>}
            {msg && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">{msg}</div>}

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-semibold text-slate-800 mb-1">Super-admin অ্যাকাউন্ট ও সেশন</h2>
                <p className="text-xs text-slate-400 mb-4">কার সেশন active, কে শেষ কবে লগইন করেছে — সন্দেহজনক কিছু দেখলে সাথে সাথে Revoke করুন।</p>
                <div className="space-y-2">
                    {admins.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
                            <div>
                                <p className="text-sm font-medium text-slate-800">
                                    {a.displayName}
                                    {a.id === selfId && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">আপনি</span>}
                                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${a.sessionActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                                        {a.sessionActive ? "active" : "logged out"}
                                    </span>
                                </p>
                                <p className="text-xs text-slate-500">
                                    {a.email} · শেষ লগইন: {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                                </p>
                            </div>
                            {a.id !== selfId && a.sessionActive && (
                                <button onClick={() => revoke(a.id, a.email)} className="flex items-center gap-1 text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
                                    <LogOut className="w-3.5 h-3.5" />
                                    Revoke
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <form onSubmit={changePassword} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                <h2 className="font-semibold text-slate-800 flex items-center gap-1.5"><KeyRound className="w-4 h-4" /> নিজের পাসওয়ার্ড বদলান</h2>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">বর্তমান পাসওয়ার্ড</label>
                    <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)</label>
                    <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm" />
                </div>
                <button type="submit" disabled={changing} className="w-full bg-slate-800 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {changing && <Loader2 className="w-4 h-4 animate-spin" />}
                    পাসওয়ার্ড আপডেট করুন
                </button>
            </form>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">পরের ধাপ: Two-factor authentication (2FA)</p>
                <p className="text-xs">TOTP-ভিত্তিক 2FA-এর জন্য DB-তে সিক্রেট রাখার জায়গা (migration) + QR সেটআপ লাগবে — এটা আলাদা ছোট প্রজেক্ট হিসেবে করলে নিরাপদ হবে। চাইলে পরের টার্নে করে দিচ্ছি। Super-admin-এর সাম্প্রতিক অ্যাকশন দেখতে <Link href="/super-admin/audit" className="underline font-medium">Audit Log</Link> ব্যবহার করুন।</p>
            </div>
        </div>
    );
}
