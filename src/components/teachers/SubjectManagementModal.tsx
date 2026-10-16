"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Subject {
    id: string;
    name: string;
    teacherUids: string[];
}

interface TeacherOption {
    id: string;
    displayName: string;
    role: string;
}

/**
 * Admin-only: the subjects teachers pick from when they log a class, and which
 * teachers take each one. A teacher sees only the subjects assigned to them.
 */
export default function SubjectManagementModal({ onClose }: { onClose: () => void }) {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // null = adding a new subject, otherwise the id being edited.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/teaching-subjects");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "বিষয় লোড করা যায়নি।");
            setSubjects(data.subjects);
            setTeachers(data.teachers);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "বিষয় লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const reset = () => {
        setEditingId(null);
        setName("");
        setSelected(new Set());
    };

    const startEdit = (s: Subject) => {
        setEditingId(s.id);
        setName(s.name);
        setSelected(new Set(s.teacherUids));
    };

    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const save = async () => {
        if (!name.trim()) {
            toast.error("বিষয়ের নাম লিখুন।");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(editingId ? `/api/teaching-subjects/${editingId}` : "/api/teaching-subjects", {
                method: editingId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, teacherUids: [...selected] }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "সেভ করা যায়নি।");
            toast.success(editingId ? "বিষয় আপডেট হয়েছে।" : "বিষয় যোগ হয়েছে।");
            reset();
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "সেভ করা যায়নি।");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (s: Subject) => {
        if (!window.confirm(`"${s.name}" বিষয়টি মুছবেন? আগের ক্লাসের রেকর্ডে নামটি থেকে যাবে।`)) return;
        const res = await fetch(`/api/teaching-subjects/${s.id}`, { method: "DELETE" });
        if (res.ok) {
            toast.success("বিষয় মুছে ফেলা হয়েছে।");
            if (editingId === s.id) reset();
            await load();
        } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || "মুছে ফেলা যায়নি।");
        }
    };

    const teacherName = (id: string) => teachers.find((t) => t.id === id)?.displayName ?? "—";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Subject Management</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            বিষয় যোগ করুন এবং কোন শিক্ষক কোন বিষয়ের ক্লাস নেন তা ঠিক করুন।
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Add / edit form */}
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-sm font-semibold text-slate-700">
                            {editingId ? "বিষয় এডিট করুন" : "নতুন বিষয় যোগ করুন"}
                        </p>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={120}
                            placeholder="যেমন: Career Planning & Branding"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div>
                            <p className="text-xs text-slate-500 mb-2">এই বিষয়ের শিক্ষক ({selected.size} জন)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-slate-100 p-2">
                                {teachers.length === 0 && (
                                    <p className="text-xs text-slate-400 p-2">কোনো শিক্ষক পাওয়া যায়নি।</p>
                                )}
                                {teachers.map((t) => (
                                    <label
                                        key={t.id}
                                        className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.has(t.id)}
                                            onChange={() => toggle(t.id)}
                                            className="accent-emerald-600"
                                        />
                                        <span className="truncate">{t.displayName}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={save}
                                disabled={saving}
                                className="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-60"
                            >
                                {saving ? "সেভ হচ্ছে..." : editingId ? "আপডেট করুন" : "যোগ করুন"}
                            </button>
                            {editingId && (
                                <button
                                    onClick={reset}
                                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    বাতিল
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Existing subjects */}
                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">সব বিষয় ({subjects.length})</p>
                        {loading ? (
                            <p className="text-sm text-slate-400">লোড হচ্ছে...</p>
                        ) : subjects.length === 0 ? (
                            <p className="text-sm text-slate-400">এখনো কোনো বিষয় যোগ করা হয়নি।</p>
                        ) : (
                            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                                {subjects.map((s) => (
                                    <li key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800">{s.name}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {s.teacherUids.length === 0
                                                    ? "কোনো শিক্ষক অ্যাসাইন করা নেই"
                                                    : s.teacherUids.map(teacherName).join(", ")}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => startEdit(s)}
                                                className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => remove(s)}
                                                className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
