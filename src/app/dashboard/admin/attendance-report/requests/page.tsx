"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ATTENDANCE_LABELS, CORRECTION_STATUS_LABELS } from "@/lib/attendance";
import type { AttendanceCorrectionStatus, AttendanceStatus } from "@prisma/client";

interface CorrectionRequest {
    id: string;
    date: string;
    batchName: string;
    roll: string;
    studentName: string;
    currentStatus: AttendanceStatus;
    requestedStatus: AttendanceStatus;
    reason: string;
    status: AttendanceCorrectionStatus;
    reviewedByName: string | null;
    reviewNote: string | null;
    createdAt: string;
}

type Filter = AttendanceCorrectionStatus | "ALL";

const FILTERS: { key: Filter; label: string }[] = [
    { key: "PENDING", label: "Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "REJECTED", label: "Rejected" },
    { key: "ALL", label: "All" },
];

const REQUEST_BADGE: Record<AttendanceCorrectionStatus, string> = {
    PENDING: "bg-blue-50 text-blue-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
};

function submittedOn(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function AttendanceRequestsPage() {
    const [filter, setFilter] = useState<Filter>("PENDING");
    const [requests, setRequests] = useState<CorrectionRequest[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const [notes, setNotes] = useState<Record<string, string>>({});
    const [deciding, setDeciding] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/attendance-corrections?status=${filter}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "আবেদন লোড করা যায়নি।");
            setRequests(data.requests);
            setPendingCount(data.pendingCount);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "আবেদন লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        load();
    }, [load]);

    const decide = async (r: CorrectionRequest, decision: "APPROVED" | "REJECTED") => {
        setDeciding(r.id);
        try {
            const res = await fetch("/api/admin/attendance-corrections", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: r.id, decision, reviewNote: (notes[r.id] ?? "").trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "সিদ্ধান্ত সেভ করা যায়নি।");
            toast.success(
                decision === "APPROVED"
                    ? `মঞ্জুর হয়েছে — ${r.date} এখন ${ATTENDANCE_LABELS[r.requestedStatus]}`
                    : "আবেদন নাকচ করা হয়েছে"
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "সিদ্ধান্ত সেভ করা যায়নি।");
        } finally {
            setDeciding(null);
            // Reload either way: a failure usually means someone else got there first.
            load();
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">হাজিরা সংশোধনের আবেদন</h1>
                <p className="text-slate-500 text-sm mt-1">
                    ছাত্ররা কোনো দিনের হাজিরা ভুল মনে করলে এখানে আবেদন আসে। মঞ্জুর করলে সেই দিনের রেকর্ড
                    সাথে সাথে বদলে যায়; নাকচ করলে রেকর্ড আগের মতোই থাকে।
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        aria-pressed={filter === f.key}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                            filter === f.key
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        {f.label}
                        {f.key === "PENDING" && pendingCount > 0 ? ` (${pendingCount})` : ""}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
                    লোড হচ্ছে...
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
                    {filter === "PENDING" ? "কোনো আবেদন অপেক্ষমাণ নেই।" : "কোনো আবেদন নেই।"}
                </div>
            ) : (
                <ul className="space-y-3">
                    {requests.map((r) => (
                        <li key={r.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
                            <div className="flex flex-wrap items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">
                                        {r.studentName}{" "}
                                        <span className="font-normal text-slate-500">
                                            · {r.batchName} · রোল {r.roll}
                                        </span>
                                    </p>
                                    <p className="text-sm text-slate-700 mt-1">
                                        <span className="font-mono">{r.date}</span> ·{" "}
                                        {ATTENDANCE_LABELS[r.currentStatus]} →{" "}
                                        <strong>{ATTENDANCE_LABELS[r.requestedStatus]}</strong>
                                    </p>
                                </div>
                                <span
                                    className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${REQUEST_BADGE[r.status]}`}
                                >
                                    {CORRECTION_STATUS_LABELS[r.status]}
                                </span>
                            </div>

                            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 break-words">
                                {r.reason}
                            </p>

                            <p className="text-xs text-slate-400">
                                আবেদন: {submittedOn(r.createdAt)}
                                {r.status !== "PENDING" && r.reviewedByName ? ` · সিদ্ধান্ত: ${r.reviewedByName}` : ""}
                                {r.reviewNote ? ` · মন্তব্য: ${r.reviewNote}` : ""}
                            </p>

                            {r.status === "PENDING" && (
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={notes[r.id] ?? ""}
                                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                                        maxLength={300}
                                        placeholder="মন্তব্য (ঐচ্ছিক) — ছাত্র দেখতে পাবে"
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        onClick={() => decide(r, "APPROVED")}
                                        disabled={deciding === r.id}
                                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => decide(r, "REJECTED")}
                                        disabled={deciding === r.id}
                                        className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-60"
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
