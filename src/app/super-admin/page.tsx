"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, GraduationCap, Plus } from "lucide-react";
import { getBilling, billingDaysLeft, isBillingExpired } from "@/lib/billing";

interface CourseWithStats {
    id: string;
    slug: string;
    name: string;
    status: string;
    primaryColor: string;
    createdAt: string;
    settings: { billing?: Record<string, unknown> };
    stats: { studentCount: number; teacherCount: number; adminCount: number };
}

const STATUS_COLOR: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    SUSPENDED: "bg-red-100 text-red-700",
    TRIAL: "bg-yellow-100 text-yellow-700",
    ARCHIVED: "bg-gray-100 text-gray-500",
};

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd";

export default function SuperAdminDashboard() {
    const [courses, setCourses] = useState<CourseWithStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/saas/courses")
            .then((r) => r.json())
            .then((d) => { setCourses(d.courses || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const totalStudents = courses.reduce((s, c) => s + c.stats.studentCount, 0);
    const totalTeachers = courses.reduce((s, c) => s + c.stats.teacherCount, 0);
    const activeCourses = courses.filter((c) => c.status === "ACTIVE" || c.status === "TRIAL").length;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">সব কোর্স</h1>
                    <p className="text-slate-500 text-sm mt-1">প্রতিটা কোর্স আলাদা সাবডোমেইনে চলে</p>
                </div>
                <Link
                    href="/super-admin/courses/new"
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    নতুন কোর্স
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg"><Building2 className="w-5 h-5 text-indigo-600" /></div>
                        <div>
                            <p className="text-sm text-slate-500">মোট কোর্স</p>
                            <p className="text-2xl font-bold text-slate-800">{courses.length}</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{activeCourses} active</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-lg"><GraduationCap className="w-5 h-5 text-green-600" /></div>
                        <div>
                            <p className="text-sm text-slate-500">মোট শিক্ষার্থী</p>
                            <p className="text-2xl font-bold text-slate-800">{totalStudents}</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">সব কোর্স মিলিয়ে</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg"><Users className="w-5 h-5 text-purple-600" /></div>
                        <div>
                            <p className="text-sm text-slate-500">মোট শিক্ষক</p>
                            <p className="text-2xl font-bold text-slate-800">{totalTeachers}</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">সব কোর্স মিলিয়ে</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-700">কোর্সের তালিকা</h2>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-slate-400">লোড হচ্ছে...</div>
                ) : courses.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">এখনো কোনো কোর্স তৈরি হয়নি।</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-100">
                                    <th className="px-4 py-3 font-medium">কোর্স</th>
                                    <th className="px-4 py-3 font-medium">সাবডোমেইন</th>
                                    <th className="px-4 py-3 font-medium">স্ট্যাটাস</th>
                                    <th className="px-4 py-3 font-medium">প্ল্যান</th>
                                    <th className="px-4 py-3 font-medium">শিক্ষার্থী</th>
                                    <th className="px-4 py-3 font-medium">শিক্ষক</th>
                                    <th className="px-4 py-3 font-medium">অ্যাডমিন</th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.map((c) => (
                                    <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <Link href={`/super-admin/courses/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                                                {c.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <a
                                                href={`https://${c.slug}.${BASE_DOMAIN}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-slate-500 hover:text-slate-700"
                                            >
                                                {c.slug}.{BASE_DOMAIN}
                                            </a>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] || "bg-gray-100 text-gray-600"}`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {(() => {
                                                const b = getBilling(c.settings);
                                                const expired = isBillingExpired(c.settings);
                                                const left = billingDaysLeft(c.settings);
                                                return (
                                                    <span title={b.expiresAt ? `Expires: ${new Date(b.expiresAt).toLocaleDateString()}` : "No expiry"} className={`px-2 py-0.5 rounded-full text-xs font-medium ${expired ? "bg-red-100 text-red-700" : left != null && left <= 7 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"}`}>
                                                        {b.plan}{expired ? " • expired" : left != null ? ` • ${left}d` : ""}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{c.stats.studentCount}</td>
                                        <td className="px-4 py-3 text-slate-600">{c.stats.teacherCount}</td>
                                        <td className="px-4 py-3 text-slate-600">{c.stats.adminCount}</td>
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
