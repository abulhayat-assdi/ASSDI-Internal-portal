"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, Trash2, Send, Loader2 } from "lucide-react";

interface Announcement {
    courseId: string;
    title: string;
    body: string;
    level: "info" | "warning" | "urgent";
    expiresAt: string | null;
    createdBy?: string;
    createdAt?: string;
    course: { id: string; slug: string; name: string };
}

interface CourseOpt { id: string; slug: string; name: string }

export default function AnnouncementsPage() {
    const [list, setList] = useState<Announcement[]>([]);
    const [courses, setCourses] = useState<CourseOpt[]>([]);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [level, setLevel] = useState<"info" | "warning" | "urgent">("info");
    const [expiresAt, setExpiresAt] = useState("");
    const [targetAll, setTargetAll] = useState(true);
    const [selected, setSelected] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        const [aRes, cRes] = await Promise.all([
            fetch("/api/saas/announcements"),
            fetch("/api/saas/courses"),
        ]);
        const a = await aRes.json();
        const c = await cRes.json();
        if (aRes.ok) setList(a.announcements || []);
        if (cRes.ok) setCourses((c.courses || []).map((x: CourseOpt) => ({ id: x.id, slug: x.slug, name: x.name })));
    }, []);

    useEffect(() => { load(); }, [load]);

    const publish = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr(""); setMsg("");
        if (!title.trim() || !body.trim()) { setErr("টাইটেল ও মেসেজ দুটোই লিখুন।"); return; }
        if (!targetAll && selected.length === 0) { setErr("কমপক্ষে একটি কোর্স সিলেক্ট করুন।"); return; }
        setSending(true);
        try {
            const res = await fetch("/api/saas/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(), body: body.trim(), level,
                    expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null,
                    targets: targetAll ? "all" : selected,
                }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || "পাঠানো যায়নি।");
            setMsg(`${d.count}টি কোর্সে announcement পাঠানো হয়েছে।`);
            setTitle(""); setBody(""); setSelected([]);
            load();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "পাঠানো যায়নি।");
        } finally {
            setSending(false);
        }
    };

    const remove = async (all: boolean, courseId?: string) => {
        if (!confirm(all ? "সব কোর্স থেকে announcement সরাতে চান?" : "এই কোর্স থেকে announcement সরাতে চান?")) return;
        const res = await fetch("/api/saas/announcements", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targets: all ? "all" : [courseId!] }),
        });
        if (res.ok) { setMsg("সরিয়ে ফেলা হয়েছে।"); load(); }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <Link href="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-4 h-4" />
                সব কোর্স
            </Link>
            <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-indigo-600" />
                <h1 className="text-xl font-bold text-slate-800">Announcements</h1>
            </div>
            <p className="text-sm text-slate-500 -mt-4">সব কোর্স বা নির্দিষ্ট কোর্সের ড্যাশবোর্ডে একসাথে নোটিশ দেখান</p>

            {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{err}</div>}
            {msg && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">{msg}</div>}

            <form onSubmit={publish} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">টাইটেল</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: ঈদের ছুটির নোটিশ" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">মেসেজ</label>
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="বিস্তারিত লিখুন…" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">ধরন</label>
                        <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm">
                            <option value="info">Info (নীল)</option>
                            <option value="warning">Warning (হলুদ)</option>
                            <option value="urgent">Urgent (লাল)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">মেয়াদ (ঐচ্ছিক)</label>
                        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                </div>
                <div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                        <input type="checkbox" checked={targetAll} onChange={(e) => setTargetAll(e.target.checked)} className="rounded" />
                        সব কোর্সে পাঠান
                    </label>
                    {!targetAll && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2">
                            {courses.map((c) => (
                                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1 hover:bg-slate-50 rounded">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(c.id)}
                                        onChange={(e) => setSelected((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))}
                                        className="rounded"
                                    />
                                    {c.name}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                <button type="submit" disabled={sending} className="flex items-center justify-center gap-1.5 w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? "পাঠানো হচ্ছে..." : "Announcement পাঠান"}
                </button>
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-slate-800">চলমান Announcements ({list.length})</h2>
                    {list.length > 0 && (
                        <button onClick={() => remove(true)} className="text-xs text-red-600 hover:underline">সব সরান</button>
                    )}
                </div>
                {list.length === 0 ? (
                    <p className="text-sm text-slate-400">কোথাও কোনো announcement চলছে না।</p>
                ) : (
                    <div className="space-y-2">
                        {list.map((a) => (
                            <div key={a.courseId} className="flex items-start justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{a.title} <span className="ml-1 text-xs font-normal px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{a.level}</span></p>
                                    <p className="text-xs text-slate-500">{a.course.name} · {a.body.slice(0, 80)}{a.body.length > 80 ? "…" : ""}</p>
                                </div>
                                <button onClick={() => remove(false, a.courseId)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg shrink-0" title="সরান">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
