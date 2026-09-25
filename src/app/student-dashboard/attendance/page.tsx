"use client";

import { useEffect, useState } from "react";
import { ATTENDANCE_LABELS } from "@/lib/attendance";
import type { AttendanceStatus } from "@prisma/client";

interface Entry {
    date: string;
    subject: string;
    status: AttendanceStatus;
    note: string;
}

interface Payload {
    tally: {
        present: number;
        absent: number;
        late: number;
        excused: number;
        counted: number;
        attended: number;
        percentage: number | null;
    };
    entries: Entry[];
    threshold: number;
}

const STATUS_BADGE: Record<AttendanceStatus, string> = {
    PRESENT: "bg-emerald-50 text-emerald-700",
    ABSENT: "bg-red-50 text-red-700",
    LATE: "bg-amber-50 text-amber-700",
    EXCUSED: "bg-slate-100 text-slate-600",
};

export default function StudentAttendancePage() {
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/attendance/me")
            .then((r) => r.json())
            .then((d) => setData(d))
            .catch(() => undefined)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-6 text-slate-400 text-sm">লোড হচ্ছে...</div>;
    if (!data) return <div className="p-6 text-slate-400 text-sm">তথ্য পাওয়া যায়নি।</div>;

    const { tally, entries, threshold } = data;
    const below = tally.percentage !== null && tally.percentage < threshold;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">আমার উপস্থিতি</h1>
                <p className="text-slate-500 text-sm mt-1">
                    দেরিতে আসা উপস্থিত হিসেবে গোনা হয়। মঞ্জুর করা ছুটি হিসাবের বাইরে থাকে।
                </p>
            </div>

            {/* Headline percentage */}
            <div
                className={`rounded-2xl p-6 text-white shadow-md ${
                    below
                        ? "bg-gradient-to-r from-red-500 to-red-600"
                        : "bg-gradient-to-r from-[#059669] to-[#10b981]"
                }`}
            >
                <p className="text-sm opacity-90">সর্বমোট উপস্থিতির হার</p>
                <p className="text-5xl font-bold mt-1">
                    {tally.percentage === null ? "—" : `${tally.percentage}%`}
                </p>
                <p className="text-sm opacity-90 mt-2">
                    {tally.counted === 0
                        ? "এখনো কোনো ক্লাসের হাজিরা নেওয়া হয়নি।"
                        : `${tally.counted}টি ক্লাসের মধ্যে ${tally.attended}টিতে উপস্থিত।`}
                </p>
                {below && (
                    <p className="text-sm font-semibold mt-3 bg-white/20 rounded-lg px-3 py-2 inline-block">
                        ⚠️ আপনার উপস্থিতি {threshold}%-এর নিচে। নিয়মিত ক্লাসে আসুন।
                    </p>
                )}
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label={ATTENDANCE_LABELS.PRESENT} value={tally.present} />
                <Stat label={ATTENDANCE_LABELS.LATE} value={tally.late} />
                <Stat label={ATTENDANCE_LABELS.ABSENT} value={tally.absent} />
                <Stat label={ATTENDANCE_LABELS.EXCUSED} value={tally.excused} />
            </div>

            {/* History */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-700 text-sm">দিনভিত্তিক রেকর্ড</h2>
                </div>
                {entries.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">কোনো রেকর্ড নেই।</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {entries.map((e, i) => (
                            <li key={`${e.date}-${e.subject}-${i}`} className="flex items-center gap-3 px-4 py-3">
                                <span className="text-sm font-mono text-slate-500 w-28 shrink-0">{e.date}</span>
                                <span className="flex-1 truncate text-sm text-slate-600">
                                    {e.subject || "ক্লাস"}
                                </span>
                                <span
                                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[e.status]}`}
                                >
                                    {ATTENDANCE_LABELS[e.status]}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">{value}</p>
        </div>
    );
}
