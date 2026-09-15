"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAllTeachers, Teacher } from "@/services/teacherService";
import { getLeavesByTeacher, Leave, syncAutoWeeklyLeaves } from "@/services/leaveService";

// ---------- Native date helpers ----------
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getMonthLabel(monthYear: string) {
    const [year, month] = monthYear.split("-");
    return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getDayName(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return DAY_NAMES[d.getDay()];
}

function formatShortDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// ---------- Component ----------
export default function LeaveTrackingPage() {
    const { userProfile } = useAuth();
    const isAdmin = userProfile?.role === "admin" || userProfile?.role === "super_admin";
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        getAllTeachers().then(all => {
            // Only show teachers with leaveTrackingEnabled === true
            const enabled = all.filter(t => t.leaveTrackingEnabled === true);
            if (isAdmin) {
                setTeachers(enabled);
                // Auto-select first teacher if available
                if (enabled.length > 0) {
                    setSelectedTeacherId(enabled[0].id);
                }
            } else {
                // Non-admins may only ever view their own leave record.
                const own = enabled.filter(t => t.teacherId === userProfile?.teacherId);
                setTeachers(own);
                if (own.length > 0) {
                    setSelectedTeacherId(own[0].id);
                }
            }
        });
    }, [isAdmin, userProfile?.teacherId]);

    useEffect(() => {
        if (!selectedTeacherId || teachers.length === 0) {
            setLeaves([]);
            setSelectedTeacher(null);
            return;
        }
        const teacher = teachers.find(t => t.id === selectedTeacherId) || null;
        setSelectedTeacher(teacher);

        const load = async () => {
            setLoading(true);
            setSyncing(true);
            try {
                if (teacher) await syncAutoWeeklyLeaves(teacher.teacherId).catch(() => {});
                const data = await getLeavesByTeacher(teacher?.teacherId || selectedTeacherId);
                setLeaves(data);
            } finally {
                setLoading(false);
                setSyncing(false);
            }
        };
        load();
    }, [selectedTeacherId, teachers]);

    // Summary stats
    const totalDays = leaves.reduce((s, l) => s + l.days, 0);
    const casualDays = leaves.filter(l => l.type === "Casual").reduce((s, l) => s + l.days, 0);
    const sickDays = leaves.filter(l => l.type === "Sick").reduce((s, l) => s + l.days, 0);
    const weeklyDays = leaves.filter(l => l.type === "WeeklyHoliday").reduce((s, l) => s + l.days, 0);

    // Group by month
    const byMonth: Record<string, Leave[]> = {};
    leaves.forEach(l => {
        if (!byMonth[l.monthYear]) byMonth[l.monthYear] = [];
        byMonth[l.monthYear].push(l);
    });
    const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

    const typeColors: Record<string, string> = {
        "WeeklyHoliday": "bg-indigo-50 text-indigo-700 border border-indigo-200",
        "Sick": "bg-amber-50 text-amber-700 border border-amber-200",
        "Casual": "bg-emerald-50 text-emerald-700 border border-emerald-200",
        "Other": "bg-slate-100 text-slate-600 border border-slate-200",
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">🌴 Leave Tracking</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isAdmin
                            ? "View leave records for all teachers. Manage leaves from Admin Panel → Leave Management."
                            : "View your own leave records."}
                    </p>
                </div>
                {syncing && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        Syncing weekly holidays…
                    </div>
                )}
            </div>

            {/* Teacher Filter — admins can browse any teacher; everyone else only sees their own record */}
            {isAdmin && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Select a Teacher</label>
                    <div className="relative w-full md:w-[420px]">
                        <select
                            value={selectedTeacherId}
                            onChange={e => setSelectedTeacherId(e.target.value)}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-medium cursor-pointer hover:bg-white transition-colors"
                        >
                            <option value="">— Choose a Teacher —</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.name}  ·  {t.designation}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▼</div>
                    </div>
                </div>
            )}

            {!isAdmin && teachers.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                    <p className="text-5xl mb-4">🌴</p>
                    <p className="text-slate-500 font-medium">Leave tracking isn&apos;t enabled for your account yet.</p>
                    <p className="text-slate-400 text-sm mt-1">Contact an admin if you think this is a mistake.</p>
                </div>
            )}

            {/* Loading spinner */}
            {loading && !syncing && (
                <div className="flex justify-center py-16">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Content */}
            {selectedTeacherId && !loading && (
                <div className="space-y-6">
                    {/* Summary Strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Total Leaves", value: totalDays, color: "from-emerald-600 to-teal-600", icon: "📊" },
                            { label: "Casual", value: casualDays, color: "from-blue-500 to-blue-700", icon: "🗓️" },
                            { label: "Sick", value: sickDays, color: "from-amber-500 to-orange-600", icon: "🤒" },
                            { label: "Weekly Off", value: weeklyDays, color: "from-indigo-500 to-violet-600", icon: "🌴" },
                        ].map(c => (
                            <div key={c.label} className={`bg-gradient-to-br ${c.color} p-5 rounded-2xl text-white shadow-md`}>
                                <div className="text-2xl mb-1">{c.icon}</div>
                                <div className="text-3xl font-extrabold">{c.value}</div>
                                <div className="text-xs font-semibold opacity-80 mt-1">{c.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Monthly cards */}
                    {sortedMonths.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
                            <p className="text-5xl mb-4">📭</p>
                            <p className="text-slate-500 font-medium">No leave records found for this teacher.</p>
                            <p className="text-slate-400 text-sm mt-1">Leaves added by the admin will appear here.</p>
                        </div>
                    ) : (
                        sortedMonths.map(month => {
                            const monthLeaves = byMonth[month].sort((a, b) => b.startDate.localeCompare(a.startDate));
                            const monthTotal = monthLeaves.reduce((s, l) => s + l.days, 0);
                            return (
                                <div key={month} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                    {/* Month header */}
                                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                                            <h3 className="text-base font-bold text-slate-800">{getMonthLabel(month)}</h3>
                                        </div>
                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-sm font-bold">
                                            {monthTotal} Day{monthTotal !== 1 ? "s" : ""}
                                        </span>
                                    </div>

                                    {/* Leave cards grid */}
                                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {monthLeaves.map(leave => (
                                            <div key={leave.id} className="relative rounded-xl border border-slate-100 bg-white p-4 hover:border-emerald-300 hover:shadow-md transition-all duration-200 group">
                                                {/* Top row */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${typeColors[leave.type] || typeColors["Other"]}`}>
                                                        {leave.type === "WeeklyHoliday" ? "Weekly Holiday" : leave.type}
                                                    </span>
                                                    <span className="text-lg font-extrabold text-slate-700 leading-none">
                                                        {leave.days}<span className="text-xs font-semibold text-slate-400 ml-0.5">d</span>
                                                    </span>
                                                </div>

                                                {/* Date */}
                                                <div className="text-sm font-semibold text-slate-800">
                                                    {leave.startDate === leave.endDate
                                                        ? formatDate(leave.startDate)
                                                        : `${formatShortDate(leave.startDate)} – ${formatDate(leave.endDate)}`
                                                    }
                                                </div>
                                                <div className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                                                    <span>📅</span>
                                                    {getDayName(leave.startDate)}
                                                </div>

                                                {/* Reason */}
                                                {leave.reason && leave.reason !== "Automated weekly off" && (
                                                    <div className="mt-3 pt-3 border-t border-slate-50 text-xs text-slate-500 italic leading-snug">
                                                        &ldquo;{leave.reason}&rdquo;
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
