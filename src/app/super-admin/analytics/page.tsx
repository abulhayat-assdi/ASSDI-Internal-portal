"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Building2, Users, GraduationCap, Activity, ScrollText } from "lucide-react";
import { isBillingExpired } from "@/lib/billing";

interface CourseRow {
    id: string; slug: string; name: string; status: string; createdAt: string;
    billing: { plan: string; expiresAt: string | null };
    students: number; teachers: number; admins: number; batches: number;
    logins7: number; logins30: number;
    homeworkSubmissions30: number;
    typingExamAttempts30: number;
    typingExamAvgWpm: number;
    deployments: number;
}

interface Stats {
    perCourse: CourseRow[];
    totals: Record<string, number>;
    activeSessions: number;
    recentLogins: number;
    signupTrend: { date: string; students: number; teachers: number }[];
    courseCount: number;
}

interface LoginDay { date: string; student: number; teacher: number; admin: number; total: number }
interface LoginTrend { days: LoginDay[]; totalLogins: number }

type LoginRange = "week" | "month" | "custom";

function isoDaysAgo(n: number): string {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<Stats | null>(null);

    const [loginRange, setLoginRange] = useState<LoginRange>("week");
    const [customFrom, setCustomFrom] = useState(isoDaysAgo(6));
    const [customTo, setCustomTo] = useState(isoDaysAgo(0));
    const [loginTrend, setLoginTrend] = useState<LoginTrend | null>(null);
    const [loginTrendLoading, setLoginTrendLoading] = useState(true);
    const [hoverDay, setHoverDay] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/saas/stats")
            .then((r) => r.json())
            .then((d) => { if (d.perCourse) setStats(d); })
            .catch(() => {});
    }, []);

    const { from, to } = useMemo(() => {
        if (loginRange === "week") return { from: isoDaysAgo(6), to: isoDaysAgo(0) };
        if (loginRange === "month") return { from: isoDaysAgo(29), to: isoDaysAgo(0) };
        return { from: customFrom, to: customTo };
    }, [loginRange, customFrom, customTo]);

    const loadLoginTrend = useCallback(() => {
        setLoginTrendLoading(true);
        fetch(`/api/saas/analytics/logins?from=${from}&to=${to}`)
            .then((r) => r.json())
            .then((d) => { if (d.days) setLoginTrend(d); })
            .catch(() => {})
            .finally(() => setLoginTrendLoading(false));
    }, [from, to]);

    useEffect(() => { loadLoginTrend(); }, [loadLoginTrend]);

    if (!stats) return <div className="p-8 text-center text-slate-400">লোড হচ্ছে...</div>;

    const maxDay = Math.max(1, ...stats.signupTrend.map((d) => d.students + d.teachers));
    const maxUsers = Math.max(1, ...stats.perCourse.map((c) => c.students + c.teachers));
    const maxLoginDay = Math.max(1, ...(loginTrend?.days.map((d) => d.total) ?? [1]));
    const expired = stats.perCourse.filter((c) => isBillingExpired({ billing: c.billing })).length;

    const cards = [
        { icon: Building2, label: "মোট কোর্স", value: stats.courseCount, sub: expired ? `${expired}টির মেয়াদ শেষ` : "সব active", color: "bg-indigo-100 text-indigo-600" },
        { icon: GraduationCap, label: "মোট শিক্ষার্থী", value: stats.totals.student || 0, sub: "সব কোর্স মিলিয়ে", color: "bg-green-100 text-green-600" },
        { icon: Users, label: "মোট শিক্ষক", value: stats.totals.teacher || 0, sub: `${stats.totals.admin || 0} অ্যাডমিন`, color: "bg-purple-100 text-purple-600" },
        { icon: Activity, label: "৭ দিনে লগইন", value: stats.recentLogins, sub: `${stats.activeSessions} active session`, color: "bg-amber-100 text-amber-600" },
    ];

    const rangeLabel = loginRange === "week" ? "শেষ ৭ দিন" : loginRange === "month" ? "শেষ ৩০ দিন" : `${from} — ${to}`;
    const hovered = loginTrend?.days.find((d) => d.date === hoverDay) ?? null;

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

            {/* Login trend — weekly (default) / monthly / custom date range, backed
                by the permanent LoginEvent history (never purged). */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-semibold text-slate-700">লগইন ট্রেন্ড</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{rangeLabel} · মোট {loginTrend?.totalLogins ?? 0}টি লগইন</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                            {([["week", "সাপ্তাহিক"], ["month", "মাসিক"], ["custom", "কাস্টম"]] as const).map(([val, label]) => (
                                <button
                                    key={val}
                                    onClick={() => setLoginRange(val)}
                                    className={`px-3 py-1.5 ${loginRange === val ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {loginRange === "custom" && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <input
                                    type="date"
                                    value={customFrom}
                                    max={customTo}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-2 py-1"
                                />
                                <span className="text-slate-400">থেকে</span>
                                <input
                                    type="date"
                                    value={customTo}
                                    min={customFrom}
                                    max={isoDaysAgo(0)}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-2 py-1"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {loginTrendLoading ? (
                    <div className="h-40 flex items-center justify-center text-sm text-slate-400">লোড হচ্ছে...</div>
                ) : !loginTrend || loginTrend.days.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-sm text-slate-400">এই সময়ে কোনো লগইন নেই।</div>
                ) : (
                    <>
                        <div className="relative flex items-end gap-1 h-40 overflow-x-auto">
                            {loginTrend.days.map((d) => (
                                <div
                                    key={d.date}
                                    className="flex-1 min-w-[6px] flex flex-col items-center gap-1 h-full justify-end cursor-default"
                                    onMouseEnter={() => setHoverDay(d.date)}
                                    onMouseLeave={() => setHoverDay((cur) => (cur === d.date ? null : cur))}
                                >
                                    <div className="w-full flex flex-col justify-end h-32 gap-px">
                                        {d.admin > 0 && (
                                            <div
                                                className="w-full bg-amber-500 first:rounded-t"
                                                style={{ height: `${(d.admin / maxLoginDay) * 100}%`, minHeight: 2 }}
                                            />
                                        )}
                                        {d.teacher > 0 && (
                                            <div
                                                className={`w-full bg-purple-400 ${d.admin === 0 ? "rounded-t" : ""}`}
                                                style={{ height: `${(d.teacher / maxLoginDay) * 100}%`, minHeight: 2 }}
                                            />
                                        )}
                                        <div
                                            className={`w-full bg-indigo-500 ${d.admin === 0 && d.teacher === 0 ? "rounded-t" : ""}`}
                                            style={{ height: `${(d.student / maxLoginDay) * 100}%`, minHeight: d.total > 0 ? 2 : 0 }}
                                        />
                                    </div>
                                    {loginTrend.days.length <= 31 && (
                                        <span className="text-[9px] text-slate-400 whitespace-nowrap">{d.date.slice(5)}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        {hovered && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 inline-flex gap-3">
                                <span className="font-medium">{hovered.date}</span>
                                <span>মোট {hovered.total}</span>
                                <span className="text-indigo-600">{hovered.student} শিক্ষার্থী</span>
                                <span className="text-purple-500">{hovered.teacher} শিক্ষক</span>
                                <span className="text-amber-600">{hovered.admin} অ্যাডমিন</span>
                            </div>
                        )}
                        <div className="flex gap-4 mt-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm inline-block" /> শিক্ষার্থী</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-purple-400 rounded-sm inline-block" /> শিক্ষক</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-sm inline-block" /> অ্যাডমিন</span>
                        </div>
                    </>
                )}
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
                                <th className="px-4 py-3 font-medium">হোমওয়ার্ক (৩০দিন)</th>
                                <th className="px-4 py-3 font-medium">টাইপিং এক্সাম (৩০দিন)</th>
                                <th className="px-4 py-3 font-medium">ডেপ্লয়মেন্ট</th>
                                <th className="px-4 py-3 font-medium">প্ল্যান</th>
                                <th className="px-4 py-3 font-medium"></th>
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
                                    <td className="px-4 py-3 text-slate-600">{c.homeworkSubmissions30}</td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {c.typingExamAttempts30}
                                        {c.typingExamAttempts30 > 0 && <span className="text-xs text-slate-400"> (গড় {c.typingExamAvgWpm} WPM)</span>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{c.deployments}</td>
                                    <td className="px-4 py-3 text-xs text-slate-600">{c.billing.plan}</td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/super-admin/audit?courseId=${c.id}`}
                                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline whitespace-nowrap"
                                        >
                                            <ScrollText className="w-3.5 h-3.5" /> লগ
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
