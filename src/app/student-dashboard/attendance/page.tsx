"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ATTENDANCE_LABELS, CORRECTION_STATUS_LABELS, correctionOptions } from "@/lib/attendance";
import type { AttendanceCorrectionStatus, AttendanceStatus } from "@prisma/client";

interface Entry {
    sessionId: string;
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

interface CorrectionRequest {
    id: string;
    sessionId: string;
    date: string;
    currentStatus: AttendanceStatus;
    requestedStatus: AttendanceStatus;
    reason: string;
    status: AttendanceCorrectionStatus;
    reviewNote: string | null;
    createdAt: string;
}

const STATUS_BADGE: Record<AttendanceStatus, string> = {
    PRESENT: "bg-emerald-50 text-emerald-700",
    ABSENT: "bg-red-50 text-red-700",
    LATE: "bg-amber-50 text-amber-700",
    EXCUSED: "bg-slate-100 text-slate-600",
};

const REQUEST_BADGE: Record<AttendanceCorrectionStatus, string> = {
    PENDING: "bg-blue-50 text-blue-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
};

export default function StudentAttendancePage() {
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);

    const [requests, setRequests] = useState<CorrectionRequest[]>([]);
    const [canApply, setCanApply] = useState(false);

    // The day the student clicked, and whether its correction form is open.
    const [selected, setSelected] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [requestedStatus, setRequestedStatus] = useState<AttendanceStatus>("PRESENT");
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadAttendance = useCallback(
        () =>
            fetch("/api/attendance/me")
                .then((r) => r.json())
                .then((d) => setData(d))
                .catch(() => undefined),
        []
    );

    const loadRequests = useCallback(
        () =>
            fetch("/api/student/attendance-corrections")
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                    if (!d) return;
                    setRequests(Array.isArray(d.requests) ? d.requests : []);
                    setCanApply(Boolean(d.canApply));
                })
                .catch(() => undefined),
        []
    );

    useEffect(() => {
        Promise.all([loadAttendance(), loadRequests()]).finally(() => setLoading(false));
    }, [loadAttendance, loadRequests]);

    if (loading) return <div className="p-6 text-slate-400 text-sm">লোড হচ্ছে...</div>;
    if (!data) return <div className="p-6 text-slate-400 text-sm">তথ্য পাওয়া যায়নি।</div>;

    const { tally, entries, threshold } = data;
    const below = tally.percentage !== null && tally.percentage < threshold;
    const pendingBySession = new Set(requests.filter((r) => r.status === "PENDING").map((r) => r.sessionId));

    const selectDay = (e: Entry) => {
        if (!canApply) return;
        setFormOpen(false);
        setReason("");
        setSelected((cur) => (cur === e.sessionId ? null : e.sessionId));
    };

    const openForm = (e: Entry) => {
        setRequestedStatus(correctionOptions(e.status)[0]);
        setFormOpen(true);
    };

    const submit = async (e: Entry) => {
        if (reason.trim().length < 5) {
            toast.error("কারণ লিখুন (কমপক্ষে ৫ অক্ষর)।");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/student/attendance-corrections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: e.sessionId, requestedStatus, reason: reason.trim() }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "আবেদন জমা দেওয়া যায়নি।");
            toast.success("আবেদন জমা হয়েছে — অ্যাডমিন অনুমোদন করলে হাজিরা ঠিক হয়ে যাবে।");
            setSelected(null);
            setFormOpen(false);
            setReason("");
            await loadRequests();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "আবেদন জমা দেওয়া যায়নি।");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">আমার উপস্থিতি</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Late counts as present. Days On Leave are left out of the percentage.
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
                    {canApply && entries.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                            কোনো দিনের হাজিরা ভুল থাকলে সেই দিনে ক্লিক করে সংশোধনের আবেদন করুন।
                        </p>
                    )}
                </div>
                {entries.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">কোনো রেকর্ড নেই।</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {entries.map((e) => {
                            const isSelected = selected === e.sessionId;
                            const hasPending = pendingBySession.has(e.sessionId);
                            return (
                                <li key={e.sessionId}>
                                    <button
                                        type="button"
                                        onClick={() => selectDay(e)}
                                        aria-expanded={canApply ? isSelected : undefined}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                                            canApply ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"
                                        } ${isSelected ? "bg-slate-50" : ""}`}
                                    >
                                        <span className="text-sm font-mono text-slate-500 w-28 shrink-0">{e.date}</span>
                                        <span className="flex-1 truncate text-sm text-slate-600">
                                            {e.subject || "ক্লাস"}
                                        </span>
                                        {hasPending && (
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                                আবেদন অপেক্ষমাণ
                                            </span>
                                        )}
                                        <span
                                            className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[e.status]}`}
                                        >
                                            {ATTENDANCE_LABELS[e.status]}
                                        </span>
                                    </button>

                                    {isSelected && (
                                        <div className="px-4 pb-4 bg-slate-50">
                                            {hasPending ? (
                                                <p className="text-sm text-slate-500">
                                                    এই দিনের জন্য আপনার একটি আবেদন অ্যাডমিনের অনুমোদনের অপেক্ষায় আছে।
                                                </p>
                                            ) : !formOpen ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openForm(e)}
                                                    className="text-sm px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-medium"
                                                >
                                                    ✏️ এই দিনের সংশোধনের আবেদন
                                                </button>
                                            ) : (
                                                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                                                    <p className="text-sm text-slate-600">
                                                        {e.date} — রেকর্ডে আছে{" "}
                                                        <strong>{ATTENDANCE_LABELS[e.status]}</strong>। অ্যাডমিন অনুমোদন
                                                        করলে তবেই হাজিরা বদলাবে।
                                                    </p>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">
                                                            সঠিক অবস্থা
                                                        </label>
                                                        <select
                                                            value={requestedStatus}
                                                            onChange={(ev) =>
                                                                setRequestedStatus(ev.target.value as AttendanceStatus)
                                                            }
                                                            className="w-full sm:w-60 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        >
                                                            {correctionOptions(e.status).map((s) => (
                                                                <option key={s} value={s}>
                                                                    {ATTENDANCE_LABELS[s]}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">
                                                            কারণ / বিবরণ
                                                        </label>
                                                        <textarea
                                                            value={reason}
                                                            onChange={(ev) => setReason(ev.target.value)}
                                                            rows={3}
                                                            maxLength={500}
                                                            placeholder="যেমন: সেদিন ক্লাসে ছিলাম, রোল কলের সময় বাইরে ছিলাম।"
                                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => submit(e)}
                                                            disabled={submitting}
                                                            className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                                                        >
                                                            {submitting ? "জমা হচ্ছে..." : "জমা দিন"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormOpen(false)}
                                                            disabled={submitting}
                                                            className="px-5 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                        >
                                                            বাতিল
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* The student's own correction requests */}
            {requests.length > 0 && (
                <div className="space-y-2">
                    <h2 className="font-semibold text-slate-700 text-sm">আমার সংশোধন আবেদন</h2>
                    {requests.map((r) => (
                        <div key={r.id} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700">
                                        <span className="font-mono">{r.date}</span> ·{" "}
                                        {ATTENDANCE_LABELS[r.currentStatus]} → {" "}
                                        <strong>{ATTENDANCE_LABELS[r.requestedStatus]}</strong>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1 break-words">{r.reason}</p>
                                    {r.reviewNote && (
                                        <p className="text-xs text-slate-500 mt-1">অ্যাডমিনের মন্তব্য: {r.reviewNote}</p>
                                    )}
                                </div>
                                <span
                                    className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${REQUEST_BADGE[r.status]}`}
                                >
                                    {CORRECTION_STATUS_LABELS[r.status]}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
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
