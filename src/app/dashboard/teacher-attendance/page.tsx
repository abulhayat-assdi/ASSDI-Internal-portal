"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { dhakaDate, formatClock, formatDuration } from "@/lib/teacherClassLog";

interface Batch {
    id: string;
    name: string;
    status?: "active" | "archived";
}

interface Subject {
    id: string;
    name: string;
    /** Only present in the admin list. */
    teacherUids?: string[];
}

interface TeacherOption {
    id: string;
    displayName: string;
}

interface ClassLog {
    id: string;
    teacherUid: string;
    teacherName: string;
    batchName: string;
    subjectId: string | null;
    subjectName: string;
    date: string;
    topic: string;
    startTime: string;
    endTime: string;
    durationMin: number;
    enteredByAdmin: boolean;
    enteredByName: string;
    canEdit: boolean;
    canDelete: boolean;
}

const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400";

/** First day of the current month in Dhaka — a sensible default window. */
const monthStart = () => `${dhakaDate().slice(0, 8)}01`;

export default function TeacherAttendancePage() {
    const { user } = useAuth();
    const isAdminUser = user?.role === "admin" || user?.role === "super_admin";
    const myId = user?.id ?? "";

    const [batches, setBatches] = useState<Batch[]>([]);
    // Teachers get only their own assigned subjects; admins get every subject
    // with who it is assigned to, so the list can follow the teacher chosen.
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);

    const [logs, setLogs] = useState<ClassLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(dhakaDate());
    const [filterTeacher, setFilterTeacher] = useState("");

    // The form. `fillOthers` is the admin "Fill up Others" mode.
    const [fillOthers, setFillOthers] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [teacherUid, setTeacherUid] = useState("");
    const [batchName, setBatchName] = useState("");
    const [date, setDate] = useState(dhakaDate());
    const [subjectId, setSubjectId] = useState("");
    const [topic, setTopic] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [saving, setSaving] = useState(false);

    // The teacher this form is for: the signed-in user, unless an admin is
    // filling in for someone else.
    const formTeacherId = fillOthers || (editingId && teacherUid) ? teacherUid : myId;

    const subjectOptions = useMemo(() => {
        if (!isAdminUser) return subjects;
        return subjects.filter((s) => s.teacherUids?.includes(formTeacherId));
    }, [subjects, isAdminUser, formTeacherId]);

    // An admin who is also a teacher has subjects of their own; one who is not
    // only gets the Fill up Others form.
    const canLogOwn = !isAdminUser || subjects.some((s) => s.teacherUids?.includes(myId));
    const formOpen = canLogOwn || fillOthers || editingId !== null;

    useEffect(() => {
        fetch("/api/schedule/batches")
            .then((r) => r.json())
            .then((d: Batch[] | { error: string }) => {
                if (Array.isArray(d)) setBatches(d.filter((b) => b.status !== "archived"));
            })
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!user) return;
        fetch("/api/teaching-subjects")
            .then((r) => r.json())
            .then((d) => {
                if (Array.isArray(d.subjects)) setSubjects(d.subjects);
                if (Array.isArray(d.teachers)) setTeachers(d.teachers);
            })
            .catch(() => undefined);
    }, [user]);

    const loadLogs = useCallback(async () => {
        setLoadingLogs(true);
        try {
            const params = new URLSearchParams({ from, to });
            if (isAdminUser && filterTeacher) params.set("teacherUid", filterTeacher);
            const res = await fetch(`/api/teacher-class-logs?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "ক্লাসের তালিকা লোড করা যায়নি।");
            setLogs(data.logs);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "ক্লাসের তালিকা লোড করা যায়নি।");
        } finally {
            setLoadingLogs(false);
        }
    }, [from, to, filterTeacher, isAdminUser]);

    useEffect(() => {
        if (user) loadLogs();
    }, [user, loadLogs]);

    // Keep the chosen subject valid when the teacher changes.
    useEffect(() => {
        if (subjectId && !subjectOptions.some((s) => s.id === subjectId)) setSubjectId("");
    }, [subjectOptions, subjectId]);

    const resetForm = () => {
        setEditingId(null);
        setTeacherUid("");
        setBatchName("");
        setSubjectId("");
        setTopic("");
        setStartTime("");
        setEndTime("");
        setDate(dhakaDate());
    };

    const startEdit = (l: ClassLog) => {
        setEditingId(l.id);
        setFillOthers(false);
        setTeacherUid(l.teacherUid);
        setBatchName(l.batchName);
        setDate(l.date);
        setSubjectId(l.subjectId ?? "");
        setTopic(l.topic);
        setStartTime(l.startTime);
        setEndTime(l.endTime);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const toggleFillOthers = () => {
        resetForm();
        setFillOthers((v) => !v);
    };

    const save = async () => {
        if (fillOthers && !teacherUid) return toast.error("শিক্ষক সিলেক্ট করুন।");
        if (!batchName) return toast.error("ব্যাচ সিলেক্ট করুন।");
        if (!subjectId) return toast.error("বিষয় সিলেক্ট করুন।");
        if (!topic.trim()) return toast.error("টপিক লিখুন।");
        if (!startTime || !endTime) return toast.error("শুরু ও শেষের সময় দিন।");
        if (endTime <= startTime) return toast.error("শেষের সময় শুরুর সময়ের পরে হতে হবে।");

        setSaving(true);
        try {
            const body = { batchName, date, subjectId, topic, startTime, endTime };
            const res = await fetch(
                editingId ? `/api/teacher-class-logs/${editingId}` : "/api/teacher-class-logs",
                {
                    method: editingId ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(fillOthers ? { ...body, teacherUid } : body),
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "সেভ করা যায়নি।");
            toast.success(editingId ? "ক্লাস আপডেট হয়েছে।" : "ক্লাস সেভ হয়েছে।");
            // Keep the Fill up Others mode and teacher on, so several classes
            // for one teacher can be entered in a row.
            const keepTeacher = fillOthers ? teacherUid : "";
            resetForm();
            setTeacherUid(keepTeacher);
            await loadLogs();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "সেভ করা যায়নি।");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (l: ClassLog) => {
        if (!window.confirm(`${l.teacherName}-এর ${l.date} তারিখের ক্লাসটি মুছবেন?`)) return;
        const res = await fetch(`/api/teacher-class-logs/${l.id}`, { method: "DELETE" });
        if (res.ok) {
            toast.success("মুছে ফেলা হয়েছে।");
            if (editingId === l.id) resetForm();
            await loadLogs();
        } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || "মুছে ফেলা যায়নি।");
        }
    };

    const totalMinutes = logs.reduce((n, l) => n + l.durationMin, 0);
    const editingLog = logs.find((l) => l.id === editingId);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Teacher Attendance</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {isAdminUser
                            ? "শিক্ষকদের নেওয়া ক্লাসের রেকর্ড। কোনো শিক্ষক নিজে না দিলে তাঁর হয়ে এখান থেকে দিতে পারবেন।"
                            : "আপনি যে ক্লাস নিয়েছেন তার ব্যাচ, বিষয়, টপিক ও সময় সেভ করুন। শুধু আপনিই নিজের রেকর্ড দেখতে পাবেন।"}
                    </p>
                </div>
                {isAdminUser && (
                    <button
                        onClick={toggleFillOthers}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            fillOthers
                                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                    >
                        {fillOthers ? "Close Fill up Others" : "Fill up Others"}
                    </button>
                )}
            </div>

            {formOpen && (
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <p className="text-sm font-semibold text-slate-700">
                        {editingId
                            ? `ক্লাস এডিট করছেন${editingLog && isAdminUser ? ` — ${editingLog.teacherName}` : ""}`
                            : fillOthers
                              ? "অন্য শিক্ষকের ক্লাস যোগ করুন"
                              : "আজকের ক্লাস সেভ করুন"}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {fillOthers && (
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">শিক্ষক</label>
                                <select value={teacherUid} onChange={(e) => setTeacherUid(e.target.value)} className={inputCls}>
                                    <option value="">— শিক্ষক বেছে নিন —</option>
                                    {teachers.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.displayName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">ব্যাচ</label>
                            <select value={batchName} onChange={(e) => setBatchName(e.target.value)} className={inputCls}>
                                <option value="">— ব্যাচ বেছে নিন —</option>
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
                                max={dhakaDate()}
                                onChange={(e) => setDate(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">বিষয় (Subject)</label>
                            <select
                                value={subjectId}
                                onChange={(e) => setSubjectId(e.target.value)}
                                disabled={fillOthers && !teacherUid}
                                className={inputCls}
                            >
                                <option value="">
                                    {subjectOptions.length === 0 ? "কোনো বিষয় অ্যাসাইন করা নেই" : "— বিষয় বেছে নিন —"}
                                </option>
                                {subjectOptions.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-1">
                            <label className="block text-xs text-slate-500 mb-1">ক্লাস টপিক</label>
                            <input
                                type="text"
                                value={topic}
                                maxLength={300}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="আজ কোন টপিকে ক্লাস নিয়েছেন"
                                className={inputCls}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">শুরুর সময়</label>
                                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">শেষের সময়</label>
                                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={save}
                            disabled={saving}
                            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition font-medium text-sm disabled:opacity-60"
                        >
                            {saving ? "সেভ হচ্ছে..." : editingId ? "সংশোধন সেভ করুন" : "Save"}
                        </button>
                        {editingId && (
                            <button
                                onClick={resetForm}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                বাতিল
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Records */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-100">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">From</label>
                        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">To</label>
                        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} />
                    </div>
                    {isAdminUser && (
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">শিক্ষক</label>
                            <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className={inputCls}>
                                <option value="">সব শিক্ষক</option>
                                {teachers.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.displayName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <span className="flex-1" />
                    <p className="text-sm text-slate-600">
                        {logs.length} টি ক্লাস · মোট <strong>{formatDuration(totalMinutes)}</strong>
                    </p>
                </div>

                {loadingLogs ? (
                    <div className="p-10 text-center text-slate-400 text-sm">লোড হচ্ছে...</div>
                ) : logs.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">এই সময়ে কোনো ক্লাসের রেকর্ড নেই।</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs">
                                <tr>
                                    <th className="text-left font-medium px-4 py-2">Date</th>
                                    {isAdminUser && <th className="text-left font-medium px-4 py-2">Teacher</th>}
                                    <th className="text-left font-medium px-4 py-2">Batch</th>
                                    <th className="text-left font-medium px-4 py-2">Subject</th>
                                    <th className="text-left font-medium px-4 py-2">Class Topic</th>
                                    <th className="text-left font-medium px-4 py-2">Time</th>
                                    <th className="text-left font-medium px-4 py-2">Duration</th>
                                    <th className="px-4 py-2" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.map((l) => (
                                    <tr key={l.id} className="align-top">
                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{l.date}</td>
                                        {isAdminUser && (
                                            <td className="px-4 py-2.5 text-slate-700">
                                                {l.teacherName}
                                                {l.enteredByAdmin && (
                                                    <span
                                                        title={`${l.enteredByName} দ্বারা এন্ট্রি`}
                                                        className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                                                    >
                                                        Admin entry
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{l.batchName}</td>
                                        <td className="px-4 py-2.5 text-slate-700">{l.subjectName}</td>
                                        <td className="px-4 py-2.5 text-slate-600">{l.topic}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                                            {formatClock(l.startTime)} – {formatClock(l.endTime)}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDuration(l.durationMin)}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                                            {l.canEdit && (
                                                <button
                                                    onClick={() => startEdit(l)}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 mr-2"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {l.canDelete && (
                                                <button
                                                    onClick={() => remove(l)}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
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
