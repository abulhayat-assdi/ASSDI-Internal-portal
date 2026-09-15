"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Building2, Users, GraduationCap, Activity } from "lucide-react";
import { isBillingExpired } from "@/lib/billing";

interface CourseRow {
    id: string; slug: string; name: string; status: string; createdAt: string;
    billing: { plan: string; expiresAt: string | null };
    students: number; teachers: number; admins: number; batches: number;
    logins7: number; logins30: number;
}

interface Stats {
    perCourse: CourseRow[];
    totals: Record<string, number>;
    activeSessions: number;
    recentLogins: number;
    signupTrend: { date: string; students: number; teachers: number }[];
    courseCount: number;
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        fetch("/api/saas/stats")
            .then((r) => r.json())
            .then((d) => { if (d.perCourse) setStats(d); })
            .catch(() => {});
    }, []);

    if (!stats) return <div className="p-8 text-center text-slate-400">লোড হচ্ছে...</div>;

    const maxDay = Math.max(1, ...stats.signupTrend.map((d) => d.students + d.teachers));
    const maxUsers = Math.max(1, ...stats.perCourse.map((c) => c.students + c.teachers));
    const expired = stats.perCourse.filter((c) => isBillingExpired({ billing: c.billing })).length;

    const cards = [
        { icon: Building2, label: "মোট কোর্স", value: stats.courseCount, sub: expired ? `${expired}টির মেয়াদ শেষ` : "সব active", color: "bg-indigo-100 text-indigo-600" },
        { icon: GraduationCap, label: "মোট শিক্ষার্থী", value: stats.totals.student || 0, sub: "সব কোর্স মিলিয়ে", color: "bg-green-100 text-green-600" },
        { icon: Users, label: "মোট শিক্ষক", value: stats.totals.teacher || 0, sub: `${stats.totals.admin || 0} অ্যাডমিন`, color: "bg-purple-100 text-purple-600" },
        { icon: Activity, label: "৭ দিনে লগইন", value: stats.recentLogins, sub: `${stats.activeSessions} active session`, color: "bg-amber-100 text-amber-600" },
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <Link href="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" />
                সব কোর্স
            </Link>
            <div className="flex items-center gap-2 mb-5">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <h1 className="text-xl font-bold text-slate-800">Platform Analytics</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {cards.map((c) => (
                    <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className={`${c.color} p-2 rounded-lg`}><c.icon className="w-5 h-5" /></div>
                            <div>
                                <p className="text-sm text-slate-500">{c.label}</p>
                                <p className="text-2xl font-bold text-slate-800">{c.value}</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">{c.sub}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6">
                <h2 className="font-semibold text-slate-700 mb-4">নতুন সাইনআপ — শেষ ১৪ দিন</h2>
                <div className="flex items-end gap-1.5 h-36">
                    {stats.signupTrend.map((d) => (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.students} student, ${d.teachers} teacher`}>
                            <div className="w-full flex flex-col justify-end h-28">
                                {d.teachers > 0 && <div className="w-full bg-purple-400 rounded-t" style={{ height: `${(d.teachers / maxDay) * 100}%`, minHeight: 3 }} />}
                                <div className={`w-full bg-indigo-500 ${d.teachers > 0 ? "" : "rounded-t"}`} style={{ height: `${(d.students / maxDay) * 100}%`, minHeight: d.students > 0 ? 3 : 0 }} />
                            </div>
                            <span className="text-[9px] text-slate-400">{d.date.slice(5)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm inline-block" /> শিক্ষার্থী</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-purple-400 rounded-sm inline-block" /> শিক্ষক</span>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-700">কোর্সভিত্তিক অবস্থা</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-100">
                                <th className="px-4 py-3 font-medium">কোর্স</th>
                                <th className="px-4 py-3 font-medium">ইউজার (বার)</th>
                                <th className="px-4 py-3 font-medium">ব্যাচ</th>
                                <th className="px-4 py-3 font-medium">৩০ দিনে লগইন</th>
                                <th className="px-4 py-3 font-medium">প্ল্যান</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.perCourse.map((c) => (
                                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <Link href={`/super-admin/courses/${c.id}`} className="font-medium text-indigo-600 hover:underline">{c.name}</Link>
                                        <p className="text-xs text-slate-400">{c.status}</p>
                                    </td>
                                    <td className="px-4 py-3 min-w-40">
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${((c.students + c.teachers) / maxUsers) * 100}%` }} />
                                        </div>
                                        <span className="text-xs text-slate-500">{c.students} ছাত্র · {c.teachers} শিক্ষক</span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{c.batches}</td>
                                    <td className="px-4 py-3 text-slate-600">{c.logins30} <span className="text-xs text-slate-400">(৭দিনে {c.logins7})</span></td>
                                    <td className="px-4 py-3 text-xs text-slate-600">{c.billing.plan}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
