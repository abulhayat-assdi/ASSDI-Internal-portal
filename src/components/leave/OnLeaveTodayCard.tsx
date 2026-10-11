"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Leave = {
    id: string;
    studentName: string;
    studentRoll: string;
    studentBatchName: string;
    endDate: string;
};

const SHOWN = 5;

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dashboard summary of students on approved leave today, linking to the full view. */
export default function OnLeaveTodayCard() {
    const [leaves, setLeaves] = useState<Leave[] | null>(null);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const settings = await fetch("/api/site-settings").then((r) => (r.ok ? r.json() : null));
                if (settings?.features?.student_leaves === false) {
                    if (alive) setEnabled(false);
                    return;
                }
                const today = todayISO();
                const res = await fetch(`/api/leave-status?from=${today}&to=${today}`);
                if (!res.ok) return;
                const data = await res.json();
                if (alive) setLeaves(data.leaves);
            } catch {
                // widget is optional — stay hidden on failure
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    if (!enabled || leaves === null) return null;

    return (
        <div className="bg-white rounded-xl shadow-soft border border-slate-100 p-5">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#1f2937] border-l-4 border-amber-400 pl-3">
                    On Leave Today
                    <span className="ml-2 text-sm font-medium text-slate-500">
                        {leaves.length === 0 ? "No one" : `${leaves.length} student${leaves.length === 1 ? "" : "s"}`}
                    </span>
                </h2>
                <Link href="/dashboard/leave-status" className="text-sm text-[#059669] hover:underline whitespace-nowrap">
                    View all →
                </Link>
            </div>
            {leaves.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {leaves.slice(0, SHOWN).map((l) => (
                        <li key={l.id} className="py-2 flex flex-wrap items-center justify-between gap-x-4">
                            <span className="font-medium text-slate-800">{l.studentName}</span>
                            <span className="text-slate-500 text-xs">
                                {l.studentBatchName} · Roll {l.studentRoll} · until {l.endDate}
                            </span>
                        </li>
                    ))}
                    {leaves.length > SHOWN && (
                        <li className="pt-2 text-xs text-slate-500">+{leaves.length - SHOWN} more</li>
                    )}
                </ul>
            )}
        </div>
    );
}
