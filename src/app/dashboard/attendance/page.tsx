"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ATTENDANCE_LABELS, today as todayStr } from "@/lib/attendance";
import type { AttendanceStatus } from "@prisma/client";

interface Batch {
    id: string;
    name: string;
}

interface Student {
    id: string;
    roll: string;
    name: string;
    photo?: string | null;
}

interface SavedRecord {
    studentId: string;
    status: AttendanceStatus;
    note: string;
}

interface ScheduledClass {
    batchName: string;
    subject: string;
    teacherName: string;
    time: string;
    attendanceTaken: boolean;
    takenByName: string | null;
}

interface SavedSession {
    id: string;
    subject: string;
    note: string;
    takenByName: string;
    updatedAt: string;
    records: SavedRecord[];
}

const STATUS_ORDER: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

const STATUS_STYLE: Record<AttendanceStatus, { on: string; off: string }> = {
    PRESENT: { on: "bg-emerald-600 text-white", off: "text-emerald-700 hover:bg-emerald-50" },
    ABSENT: { on: "bg-red-600 text-white", off: "text-red-700 hover:bg-red-50" },
    LATE: { on: "bg-amber-500 text-white", off: "text-amber-700 hover:bg-amber-50" },
    EXCUSED: { on: "bg-slate-600 text-white", off: "text-slate-600 hover:bg-slate-100" },
};

export default function AttendancePage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [batchName, setBatchName] = useState("");
    const [date, setDate] = useState(todayStr());
    const [subject, setSubject] = useState("");
    const [note, setNote] = useState("");

    const [students, setStudents] = useState<Student[]>([]);
    const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
    const [savedAt, setSavedAt] = useState<SavedSession | null>(null);

    const [scheduled, setScheduled] = useState<ScheduledClass[]>([]);
    const [loadingRoster, setLoadingRoster] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/schedule/batches")
            .then((r) => r.json())
            .then((d: Batch[] | { error: string }) => {
                if (Array.isArray(d)) {
                    setBatches(d);
                    if (d.length && !batchName) setBatchName(d[0].name);
                }
            })
            .catch(() => toast.error("ব্যাচ তালিকা লোড করা যায়নি।"));
        // Runs once — the batch list doesn't change while the screen is open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** The routine's classes for the chosen day, with roll-call status. */
    const loadScheduled = useCallback(async () => {
        try {
            const res = await fetch(`/api/attendance/today?date=${date}`);
            const data = await res.json();
            setScheduled(Array.isArray(data.classes) ? data.classes : []);
        } catch {
            setScheduled([]);
        }
    }, [date]);

    useEffect(() => {
        loadScheduled();
    }, [loadScheduled]);

    /** Loads the batch roster and, if this day was already taken, its saved marks. */
    const loadRoster = useCallback(async () => {
        if (!batchName) return;
        setLoadingRoster(true);
        try {
            const [rosterRes, sessionRes] = await Promise.all([
                fetch(`/api/batch-info?batchName=${encodeURIComponent(batchName)}`),
                fetch(
                    `/api/attendance/sessions?batchName=${encodeURIComponent(batchName)}&date=${date}`
                ),
            ]);
            const roster: Student[] = await rosterRes.json();
            const { session }: { session: SavedSession | null } = await sessionRes.json();

            const list = Array.isArray(roster) ? roster : [];
            setStudents(list);
            setSavedAt(session);

            if (session) {
                const restored: Record<string, AttendanceStatus> = {};
                for (const r of session.records) restored[r.studentId] = r.status;
                // Anyone who joined the batch after the roll call was taken
                // starts as present rather than silently unmarked.
                for (const s of list) if (!(s.id in restored)) restored[s.id] = "PRESENT";
                setMarks(restored);
                setSubject(session.subject);
                setNote(session.note);
            } else {
                setMarks(Object.fromEntries(list.map((s) => [s.id, "PRESENT" as AttendanceStatus])));
                setNote("");
            }
        } catch {
            toast.error("ছাত্রদের তালিকা লোড করা যায়নি।");
        } finally {
            setLoadingRoster(false);
        }
    }, [batchName, date]);

    useEffect(() => {
        loadRoster();
    }, [loadRoster]);

    const counts = useMemo(() => {
        const c: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
        for (const s of students) c[marks[s.id] ?? "PRESENT"]++;
        return c;
    }, [students, marks]);

    const setAll = (status: AttendanceStatus) =>
        setMarks(Object.fromEntries(students.map((s) => [s.id, status])));

    const save = async () => {
        if (!students.length) return;
        setSaving(true);
        try {
            const res = await fetch("/api/attendance/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    batchName,
                    date,
                    subject: subject.trim(),
                    note: note.trim(),
                    records: students.map((s) => ({
                        studentId: s.id,
                        status: marks[s.id] ?? "PRESENT",
                        note: "",
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "সেভ করা যায়নি।");
            setSavedAt(data.session);
            loadScheduled();
            toast.success("অ্যাটেনডেন্স সেভ হয়েছে।");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "সেভ করা যায়নি।");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">অ্যাটেনডেন্স</h1>
                <p className="text-slate-500 text-sm mt-1">
                    প্রতিদিন প্রতি ব্যাচে একবার রোল কল — যে কোনো শিক্ষক নিতে পারেন। একই দিনে আবার সেভ
                    করলে আগেরটাই সংশোধন হবে, নতুন করে গোনা হবে না।
                </p>
            </div>

            {/* Today's classes, straight from the routine */}
            {scheduled.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">
                        {date === todayStr() ? "আজকের ক্লাস" : `${date} তারিখের ক্লাস`}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                            (রুটিন থেকে — ট্যাপ করলে ব্যাচ ও বিষয় বসে যাবে)
                        </span>
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {scheduled.map((c) => {
                            const active = c.batchName === batchName;
                            return (
                                <button
                                    key={c.batchName}
                                    onClick={() => {
                                        setBatchName(c.batchName);
                                        if (c.subject) setSubject(c.subject);
                                    }}
                                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                                        active
                                            ? "border-emerald-500 bg-emerald-50"
                                            : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                                    }`}
                                >
                                    <span className="block text-sm font-medium text-slate-700">
                                        {c.batchName}
                                        {c.time ? (
                                            <span className="ml-2 text-xs font-normal text-slate-400">{c.time}</span>
                                        ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 truncate max-w-[220px]">
                                        {c.subject || "বিষয় লেখা নেই"}
                                    </span>
                                    <span
                                        className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                            c.attendanceTaken
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-amber-100 text-amber-700"
                                        }`}
                                    >
                                        {c.attendanceTaken
                                            ? `নেওয়া হয়েছে${c.takenByName ? ` — ${c.takenByName}` : ""}`
                                            : "এখনো নেওয়া হয়নি"}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selectors */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">ব্যাচ</label>
                    <select
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        {batches.length === 0 && <option value="">ব্যাচ নেই</option>}
                        {batches.map((b) => (
                            <option key={b.id} value={b.name}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">তারিখ</label>
                    <input
                        type="date"
                        value={date}
                        max={todayStr()}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">বিষয় (ঐচ্ছিক, শুধু রেকর্ডের জন্য)</label>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="যেমন: Sales Mastery"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
            </div>

            {savedAt && (
                <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-4 py-2 text-sm">
                    এই দিনের রোল কল আগেই নিয়েছেন {savedAt.takenByName || "অজানা"}। এখন সংশোধন করছেন —
                    নতুন করে গোনা হবে না।
                </div>
            )}

            {/* Summary + bulk actions */}
            {students.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    {STATUS_ORDER.map((s) => (
                        <span key={s} className="text-sm text-slate-600">
                            {ATTENDANCE_LABELS[s]}: <strong>{counts[s]}</strong>
                        </span>
                    ))}
                    <span className="flex-1" />
                    <button
                        onClick={() => setAll("PRESENT")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                        সবাই উপস্থিত
                    </button>
                    <button
                        onClick={() => setAll("ABSENT")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                    >
                        সবাই অনুপস্থিত
                    </button>
                </div>
            )}

            {/* Roster */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {loadingRoster ? (
                    <div className="p-10 text-center text-slate-400 text-sm">লোড হচ্ছে...</div>
                ) : students.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">
                        এই ব্যাচে কোনো ছাত্র পাওয়া যায়নি।
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {students.map((s) => {
                            const current = marks[s.id] ?? "PRESENT";
                            return (
                                <li
                                    key={s.id}
                                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="w-12 shrink-0 text-xs font-mono text-slate-400">
                                            {s.roll}
                                        </span>
                                        <span className="truncate text-sm font-medium text-slate-700">
                                            {s.name}
                                        </span>
                                    </div>
                                    <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                                        {STATUS_ORDER.map((status) => {
                                            const active = current === status;
                                            const style = STATUS_STYLE[status];
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() =>
                                                        setMarks((m) => ({ ...m, [s.id]: status }))
                                                    }
                                                    aria-pressed={active}
                                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                                        active ? style.on : `bg-white ${style.off}`
                                                    }`}
                                                >
                                                    {ATTENDANCE_LABELS[status]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Note + save */}
            {students.length > 0 && (
                <div className="space-y-3">
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="এই ক্লাস সম্পর্কে নোট (ঐচ্ছিক)"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                        onClick={save}
                        disabled={saving}
                        className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition font-medium text-sm disabled:opacity-60"
                    >
                        {saving ? "সেভ হচ্ছে..." : savedAt ? "সংশোধন সেভ করুন" : "অ্যাটেনডেন্স সেভ করুন"}
                    </button>
                </div>
            )}
        </div>
    );
}
