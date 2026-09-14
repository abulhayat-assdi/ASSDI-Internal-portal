"use client";

import { useState, useEffect, useCallback } from "react";
import AdminRoute from "@/components/auth/AdminRoute";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/components/ui/Toast";

// ─── Types ───────────────────────────────────────────────────
interface ModuleClass {
    className: string;
    discussionArea: string[];
    learningObjective: string;
    days: string;
}

interface SubModule {
    moduleNumber: number;
    moduleTitle: string;
    classes: ModuleClass[];
}

interface CourseModule {
    id: string;
    slug: string;
    title: string;
    description: string;
    pdfLink: string;
    bullets: string[];
    curriculum: SubModule[];
    isPublished: boolean;
    order: number;
    teacherName: string;
    teacherEmail: string;
    createdAt: string;
    updatedAt: string;
}

type FormData = Omit<CourseModule, "id" | "createdAt" | "updatedAt" | "pdfLink">;

const EMPTY_CLASS: ModuleClass = { className: "", discussionArea: [], learningObjective: "", days: "" };
const EMPTY_SUBMODULE: SubModule = { moduleNumber: 1, moduleTitle: "", classes: [{ ...EMPTY_CLASS }] };

const EMPTY_FORM: FormData = {
    slug: "", title: "", description: "",
    bullets: ["", "", "", ""],
    curriculum: [{ ...EMPTY_SUBMODULE, classes: [{ ...EMPTY_CLASS }] }],
    isPublished: true, order: 0,
    teacherName: "", teacherEmail: "",
};

// ─── Main Page ───────────────────────────────────────────────
export default function CourseModulesAdminPage() {
    const confirm = useConfirm();
    const { success, error: toastError, warning, showResults } = useToast();
    const [modules, setModules] = useState<CourseModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [bulkResetting, setBulkResetting] = useState(false);
    const [resettingSlug, setResettingSlug] = useState<string | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);

    // Editor state
    const [mode, setMode] = useState<"list" | "create" | "edit">("list");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"card" | "curriculum">("card");
    const [form, setForm] = useState<FormData>(EMPTY_FORM);

    const load = useCallback(async () => {
        setLoading(true);
        setDbError(null);
        try {
            const res = await fetch("/api/admin/course-modules");
            const data = await res.json();
            if (!res.ok) {
                setDbError(data.error ?? "Failed to load");
                setModules([]);
            } else {
                setModules(Array.isArray(data) ? data : []);
            }
        } catch {
            setDbError("Network error — could not reach API");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // ── Seed initial data ────────────────────────────────────
    const handleSeed = async () => {
        const ok = await confirm({
            message: `Sync করলে code-এ নতুন যোগ করা module গুলো DB-তে add হবে। আগে থেকে থাকা module গুলো unchanged থাকবে।`,
            variant: "warning",
        });
        if (!ok) return;
        setSeeding(true);
        try {
            const res = await fetch("/api/admin/course-modules/seed", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            await load();
            const resultItems = (data.results as string[]).map(r => ({
                text: r,
                status: r.includes("created") ? "created" as const
                      : r.includes("skipped") ? "skipped" as const
                      : "error" as const,
            }));
            showResults("Sync সম্পন্ন!", resultItems);
        } catch (err: unknown) {
            toastError("Sync Failed", err instanceof Error ? err.message : "Unknown error");
        } finally {
            setSeeding(false);
        }
    };

    // ── Bulk reset all modules from code ─────────────────────
    const handleBulkReset = async () => {
        const ok = await confirm({
            message: `Code-এ যত module আছে সবগুলোর title, description ও curriculum code থেকে আপডেট হবে। আপনার করা slug/order/bullets পরিবর্তন অক্ষুণ্ণ থাকবে। Continue?`,
            variant: "warning",
        });
        if (!ok) return;
        setBulkResetting(true);
        try {
            const res = await fetch("/api/admin/course-modules/bulk-reset", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            await load();
            const resultItems = (data.results as { slug: string; status: string }[]).map(r => ({
                text: `${r.slug}: ${r.status}`,
                status: r.status.includes("updated") ? "created" as const
                      : r.status.includes("skipped") ? "skipped" as const
                      : "error" as const,
            }));
            showResults("Update সম্পন্ন!", resultItems);
        } catch (err: unknown) {
            toastError("Update Failed", err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBulkResetting(false);
        }
    };

    // ── Open create / edit ───────────────────────────────────
    const openCreate = () => {
        const nextOrder = modules.length > 0 ? Math.max(...modules.map(m => m.order)) + 1 : 0;
        setForm({ ...EMPTY_FORM, order: nextOrder, bullets: ["", "", "", ""] });
        setEditingId(null);
        setActiveTab("card");
        setMode("create");
    };

    const openEdit = (m: CourseModule) => {
        setForm({
            slug: m.slug, title: m.title, description: m.description,
            bullets: m.bullets.length ? m.bullets : ["", "", "", ""],
            curriculum: m.curriculum.length ? m.curriculum : [{ ...EMPTY_SUBMODULE, classes: [{ ...EMPTY_CLASS }] }],
            isPublished: m.isPublished, order: m.order,
            teacherName: m.teacherName ?? "",
            teacherEmail: m.teacherEmail ?? "",
        });
        setEditingId(m.id);
        setActiveTab("card");
        setMode("edit");
    };

    // ── Delete ───────────────────────────────────────────────
    const handleDelete = async (m: CourseModule) => {
        const ok = await confirm({ message: `"${m.title}" module টি permanently delete করবেন?`, variant: "danger" });
        if (!ok) return;
        try {
            const res = await fetch(`/api/admin/course-modules/${m.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            await load();
        } catch {
            toastError("Delete Failed", "Module delete করা সম্ভব হয়নি।");
        }
    };

    // ── Reset curriculum from data file ─────────────────────
    const handleResetCurriculum = async (m: CourseModule) => {
        const ok = await confirm({
            message: `"${m.title}" module-এর curriculum কি data file থেকে reset করবেন? Database-এর বর্তমান curriculum replace হয়ে যাবে।`,
            variant: "warning",
        });
        if (!ok) return;
        setResettingSlug(m.slug);
        try {
            const res = await fetch("/api/admin/course-modules/reset-curriculum", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: m.slug }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Reset failed");
            await load();
            success("Curriculum Reset!", data.message);
        } catch (err: unknown) {
            toastError("Reset Failed", err instanceof Error ? err.message : "Unknown error");
        } finally {
            setResettingSlug(null);
        }
    };

    // ── Save ─────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.slug.trim() || !form.title.trim()) {
            warning("Required Fields", "Title এবং Slug অবশ্যই দিতে হবে।");
            return;
        }
        setSaving(true);
        try {
            const cleanSlug = autoSlug(form.slug);
            if (!cleanSlug) {
                warning("Invalid Slug", "Slug-এ অন্তত একটি অক্ষর বা সংখ্যা থাকতে হবে।");
                setSaving(false);
                return;
            }
            const payload = {
                ...form,
                slug: cleanSlug,
                teacherName: form.teacherName.trim(),
                teacherEmail: form.teacherEmail.trim(),
                bullets: form.bullets.filter(b => b.trim()),
                curriculum: form.curriculum.map((sm, idx) => ({
                    ...sm,
                    moduleNumber: idx + 1,
                    classes: sm.classes.map(cls => ({
                        ...cls,
                        discussionArea: typeof cls.discussionArea === "string"
                            ? (cls.discussionArea as string).split("\n").map(s => s.trim()).filter(Boolean)
                            : cls.discussionArea.filter(Boolean),
                    })),
                })),
            };

            const url = editingId ? `/api/admin/course-modules/${editingId}` : "/api/admin/course-modules";
            const method = editingId ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            await load();
            success("Saved!", editingId ? "Module সফলভাবে আপডেট হয়েছে।" : "নতুন module তৈরি হয়েছে।");
        } catch (err: unknown) {
            toastError("Save Failed", err instanceof Error ? err.message : "Unknown error");
        } finally {
            setSaving(false);
        }
    };

    // ── Form helpers ─────────────────────────────────────────
    const setBullet = (i: number, val: string) =>
        setForm(f => { const b = [...f.bullets]; b[i] = val; return { ...f, bullets: b }; });

    const addBullet = () => setForm(f => ({ ...f, bullets: [...f.bullets, ""] }));
    const removeBullet = (i: number) =>
        setForm(f => ({ ...f, bullets: f.bullets.filter((_, idx) => idx !== i) }));

    const addSubModule = () =>
        setForm(f => ({
            ...f,
            curriculum: [...f.curriculum, {
                moduleNumber: f.curriculum.length + 1,
                moduleTitle: "",
                classes: [{ ...EMPTY_CLASS }],
            }],
        }));

    const removeSubModule = (si: number) =>
        setForm(f => ({ ...f, curriculum: f.curriculum.filter((_, i) => i !== si) }));

    const setSubModuleTitle = (si: number, val: string) =>
        setForm(f => {
            const c = f.curriculum.map((sm, i) => i === si ? { ...sm, moduleTitle: val } : sm);
            return { ...f, curriculum: c };
        });

    const addClass = (si: number) =>
        setForm(f => {
            const c = f.curriculum.map((sm, i) =>
                i === si ? { ...sm, classes: [...sm.classes, { ...EMPTY_CLASS }] } : sm
            );
            return { ...f, curriculum: c };
        });

    const removeClass = (si: number, ci: number) =>
        setForm(f => {
            const c = f.curriculum.map((sm, i) =>
                i === si ? { ...sm, classes: sm.classes.filter((_, j) => j !== ci) } : sm
            );
            return { ...f, curriculum: c };
        });

    const setClassField = (si: number, ci: number, field: keyof ModuleClass, val: string) =>
        setForm(f => {
            const c = f.curriculum.map((sm, i) =>
                i === si ? {
                    ...sm,
                    classes: sm.classes.map((cls, j) =>
                        j === ci ? { ...cls, [field]: val } : cls
                    ),
                } : sm
            );
            return { ...f, curriculum: c };
        });

    const autoSlug = (title: string) =>
        title.toLowerCase().trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "");

    // ─── Render ───────────────────────────────────────────────

    if (mode !== "list") {
        return (
            <AdminRoute>
                <div className="space-y-6 pb-20">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMode("list")}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="w-1 h-10 bg-[#059669] rounded-full" />
                            <div>
                                <h1 className="text-2xl font-bold text-[#1f2937]">
                                    {mode === "create" ? "New Course Module" : `Edit: ${form.title || "Module"}`}
                                </h1>
                                <p className="text-sm text-[#6b7280]">
                                    {mode === "create" ? "নতুন module তৈরি করুন" : "Module-এর content update করুন"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#059669] text-white font-semibold rounded-xl hover:bg-[#047857] transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {saving ? (
                                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            {saving ? "Saving..." : "Save Module"}
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-gray-200">
                        <div className="flex gap-1">
                            {(["card", "curriculum"] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-colors ${
                                        activeTab === tab
                                            ? "bg-white border border-b-0 border-gray-200 text-[#059669] -mb-px"
                                            : "text-gray-500 hover:text-gray-700"
                                    }`}
                                >
                                    {tab === "card" ? "📋 Card Settings" : "📚 Curriculum"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Tab: Card Settings ── */}
                    {activeTab === "card" && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Title */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Module Title *</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={e => {
                                            const t = e.target.value;
                                            setForm(f => ({ ...f, title: t, slug: f.slug || autoSlug(t) }));
                                        }}
                                        placeholder="e.g. Sales Mastery"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669]"
                                    />
                                </div>

                                {/* Slug */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">
                                        URL Slug *{" "}
                                        <span className="font-normal text-gray-400 text-xs">(e.g. sales-mastery)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.slug}
                                        onChange={e => setForm(f => ({ ...f, slug: autoSlug(e.target.value) }))}
                                        placeholder="sales-mastery"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669] font-mono"
                                    />
                                    <p className="text-xs text-gray-400">URL: /dashboard/course-modules/<strong>{form.slug || "..."}</strong></p>
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-sm font-semibold text-gray-700">Description</label>
                                    <textarea
                                        value={form.description}
                                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        rows={2}
                                        placeholder="A comprehensive journey designed to build your skills..."
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669] resize-none"
                                    />
                                </div>

                                {/* Teacher Name */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Teacher Name</label>
                                    <input
                                        type="text"
                                        value={form.teacherName}
                                        onChange={e => setForm(f => ({ ...f, teacherName: e.target.value }))}
                                        placeholder="e.g. Mohammad Abu Zabar"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669]"
                                    />
                                </div>

                                {/* Teacher Email */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Teacher Email</label>
                                    <input
                                        type="email"
                                        value={form.teacherEmail}
                                        onChange={e => setForm(f => ({ ...f, teacherEmail: e.target.value }))}
                                        placeholder="e.g. teacher@example.com"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669]"
                                    />
                                </div>

                                {/* Order & Published */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Display Order</label>
                                    <input
                                        type="number"
                                        value={form.order}
                                        onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669]"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Visibility</label>
                                    <label className="flex items-center gap-3 h-[42px] px-4 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                        <div
                                            onClick={() => setForm(f => ({ ...f, isPublished: !f.isPublished }))}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${form.isPublished ? "bg-[#059669]" : "bg-gray-300"}`}
                                        >
                                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPublished ? "translate-x-5" : ""}`} />
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">
                                            {form.isPublished ? "Published (দেখা যাচ্ছে)" : "Draft (লুকানো)"}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Bullets */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700">Card Bullet Points</label>
                                        <p className="text-xs text-gray-400 mt-0.5">Course Modules পেইজের card-এ এই bullet গুলো দেখাবে</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addBullet}
                                        className="text-xs font-semibold text-[#059669] hover:text-[#047857] flex items-center gap-1"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add bullet
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {form.bullets.map((b, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ecfdf5] flex items-center justify-center mt-2.5">
                                                <svg className="w-3 h-3 text-[#059669]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                value={b}
                                                onChange={e => setBullet(i, e.target.value)}
                                                placeholder={`Bullet ${i + 1}...`}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669]"
                                            />
                                            {form.bullets.length > 1 && (
                                                <button onClick={() => removeBullet(i)} className="mt-2 text-red-400 hover:text-red-600 flex-shrink-0">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Preview hint */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                                <strong>Preview:</strong> Card টি <a href="/dashboard/course-modules" target="_blank" className="underline">Course Modules</a> পেইজে দেখাবে — Title বড় হরফে, তারপর প্রতিটি bullet checkmark সহ।
                                "See Full Module" বাটনে ক্লিক করলে{" "}
                                <a href={`/dashboard/course-modules/${form.slug}`} target="_blank" className="underline">/dashboard/course-modules/{form.slug || "..."}</a> curriculum পেইজ ওপেন হবে।
                            </div>
                        </div>
                    )}

                    {/* ── Tab: Curriculum ── */}
                    {activeTab === "curriculum" && (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
                                <strong>Curriculum Structure:</strong> প্রতিটি Topic (Sub-module) এর ভেতর Class গুলো থাকে। Class Name-এ একাধিক লাইন লিখলে সব দেখাবে। Discussion Area-তে প্রতি লাইন একটি bullet হবে।
                            </div>

                            {form.curriculum.map((sm, si) => (
                                <div key={si} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                                    {/* Sub-module header */}
                                    <div className="flex items-center gap-3 px-5 py-4 bg-[#1e293b] text-white">
                                        <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold">
                                            {String(si + 1).padStart(2, "0")}
                                        </span>
                                        <input
                                            type="text"
                                            value={sm.moduleTitle}
                                            onChange={e => setSubModuleTitle(si, e.target.value)}
                                            placeholder="Topic Title (e.g. Sales, Soft Skills)"
                                            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/50"
                                        />
                                        {form.curriculum.length > 1 && (
                                            <button onClick={() => removeSubModule(si)} className="text-white/60 hover:text-red-300 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Classes */}
                                    <div className="divide-y divide-gray-100">
                                        {sm.classes.map((cls, ci) => (
                                            <div key={ci} className="p-5 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Class {ci + 1}</span>
                                                    {sm.classes.length > 1 && (
                                                        <button onClick={() => removeClass(si, ci)} className="text-red-400 hover:text-red-600 transition-colors">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    {/* Class Name */}
                                                    <div className="md:col-span-5 space-y-1">
                                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Class Name</label>
                                                        <textarea
                                                            value={cls.className}
                                                            onChange={e => setClassField(si, ci, "className", e.target.value)}
                                                            rows={2}
                                                            placeholder="e.g. Introduction to Sales&#10;Preparation for Sales"
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669] resize-none"
                                                        />
                                                        <p className="text-xs text-gray-400">একাধিক class একসাথে লিখতে পারেন</p>
                                                    </div>
                                                    {/* Discussion Area */}
                                                    <div className="md:col-span-7 space-y-1">
                                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Discussion Area</label>
                                                        <textarea
                                                            value={Array.isArray(cls.discussionArea) ? cls.discussionArea.join("\n") : cls.discussionArea}
                                                            onChange={e => setClassField(si, ci, "discussionArea", e.target.value)}
                                                            rows={3}
                                                            placeholder="Introduction to Sales&#10;Preparation for Sales&#10;Personal Grooming"
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669] resize-none"
                                                        />
                                                        <p className="text-xs text-gray-400">প্রতি লাইন = একটি bullet point</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    {/* Learning Objective */}
                                                    <div className="md:col-span-10 space-y-1">
                                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Learning Objective</label>
                                                        <input
                                                            type="text"
                                                            value={cls.learningObjective}
                                                            onChange={e => setClassField(si, ci, "learningObjective", e.target.value)}
                                                            placeholder="What students will learn..."
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669]"
                                                        />
                                                    </div>
                                                    {/* Days */}
                                                    <div className="md:col-span-2 space-y-1">
                                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Days</label>
                                                        <input
                                                            type="text"
                                                            value={cls.days}
                                                            onChange={e => setClassField(si, ci, "days", e.target.value)}
                                                            placeholder="1"
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669]"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add class button */}
                                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                                        <button
                                            onClick={() => addClass(si)}
                                            className="flex items-center gap-2 text-sm font-semibold text-[#059669] hover:text-[#047857] transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Add Class to this Topic
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add sub-module */}
                            <button
                                onClick={addSubModule}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 border-2 border-dashed border-[#059669]/40 rounded-2xl text-sm font-semibold text-[#059669] hover:bg-[#ecfdf5] hover:border-[#059669] transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add New Topic (Sub-module)
                            </button>
                        </div>
                    )}

                    {/* Bottom save bar */}
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3 z-10">
                        <button onClick={() => setMode("list")} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#059669] text-white font-semibold rounded-xl hover:bg-[#047857] transition-colors disabled:opacity-50 shadow-sm text-sm"
                        >
                            {saving ? (
                                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : null}
                            {saving ? "Saving..." : "Save Module"}
                        </button>
                    </div>
                </div>
            </AdminRoute>
        );
    }

    // ─── List View ────────────────────────────────────────────
    return (
        <AdminRoute>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-10 bg-[#059669] rounded-full" />
                        <div>
                            <h1 className="text-3xl font-bold text-[#1f2937]">Course Modules</h1>
                            <p className="text-[#6b7280] mt-1">এই কোর্সের module গুলো manage করুন</p>
                        </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={handleSeed}
                            disabled={seeding || bulkResetting}
                            title="Code-এ নতুন যোগ করা module DB-তে add করুন (existing গুলো unchanged থাকবে)"
                            className="flex items-center gap-2 px-4 py-2.5 border-2 border-amber-500 text-amber-600 font-semibold rounded-xl hover:bg-amber-50 transition-colors text-sm disabled:opacity-50"
                        >
                            {seeding ? (
                                <span className="inline-block w-4 h-4 border-2 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            )}
                            {seeding ? "Syncing..." : "Sync Modules"}
                        </button>
                        <button
                            onClick={handleBulkReset}
                            disabled={bulkResetting || seeding}
                            title="Code থেকে সব module-এর title, description ও curriculum আপডেট করুন"
                            className="flex items-center gap-2 px-4 py-2.5 border-2 border-blue-500 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors text-sm disabled:opacity-50"
                        >
                            {bulkResetting ? (
                                <span className="inline-block w-4 h-4 border-2 border-blue-400/40 border-t-blue-500 rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            )}
                            {bulkResetting ? "Updating..." : "Update All from Code"}
                        </button>
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#059669] text-white font-semibold rounded-xl hover:bg-[#047857] transition-colors shadow-sm text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Module
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Total Modules", value: modules.length, color: "from-[#059669] to-[#34d399]" },
                        { label: "Published", value: modules.filter(m => m.isPublished).length, color: "from-blue-500 to-blue-400" },
                        { label: "Draft", value: modules.filter(m => !m.isPublished).length, color: "from-gray-500 to-gray-400" },
                        { label: "Sub-modules", value: modules.reduce((sum, m) => sum + (m.curriculum?.length ?? 0), 0), color: "from-purple-500 to-purple-400" },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                            <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                                <span className="text-white font-bold text-lg">{stat.value}</span>
                            </div>
                            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Module list */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#059669]/20 border-t-[#059669] rounded-full animate-spin" />
                    </div>
                ) : dbError ? (
                    <div className="bg-white rounded-2xl border border-dashed border-red-200 p-16 text-center">
                        <div className="text-5xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-gray-700 mb-2">Module লোড করা যায়নি</h3>
                        <p className="text-xs text-red-400 mb-6 font-mono bg-red-50 px-3 py-1.5 rounded inline-block">{dbError}</p>
                        <button
                            onClick={load}
                            className="px-6 py-3 bg-[#059669] text-white font-semibold rounded-xl hover:bg-[#047857] transition-colors text-sm shadow-sm"
                        >
                            আবার চেষ্টা করুন
                        </button>
                    </div>
                ) : modules.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
                        <div className="text-5xl mb-4">📚</div>
                        <h3 className="text-xl font-bold text-gray-700 mb-2">কোনো module নেই</h3>
                        <p className="text-gray-400 mb-6 text-sm">
                            "Import Existing Modules" বাটনে ক্লিক করে আপনার বর্তমান ১০টি module import করুন,<br />
                            অথবা "New Module" দিয়ে নতুন module তৈরি করুন।
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={handleSeed} disabled={seeding} className="px-5 py-2.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors text-sm">
                                Import Existing Modules
                            </button>
                            <button onClick={openCreate} className="px-5 py-2.5 bg-[#059669] text-white font-semibold rounded-xl hover:bg-[#047857] transition-colors text-sm">
                                New Module
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {modules.map((m, idx) => (
                            <div
                                key={m.id}
                                className="group bg-white rounded-2xl border border-gray-100 hover:border-[#059669]/30 hover:shadow-md transition-all overflow-hidden"
                            >
                                {/* Green top accent */}
                                <div className="h-1 bg-gradient-to-r from-[#059669] via-[#34d399] to-[#059669] opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="p-5">
                                    {/* Row: number + title + badge */}
                                    <div className="flex items-start gap-3 mb-3">
                                        <span className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#059669] group-hover:text-white text-gray-500 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors mt-0.5">
                                            {String(idx + 1).padStart(2, "0")}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-[#1f2937] leading-snug line-clamp-2">{m.title}</h3>
                                            <p className="text-xs text-gray-400 font-mono mt-0.5">/dashboard/course-modules/{m.slug}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${m.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                            {m.isPublished ? "Live" : "Draft"}
                                        </span>
                                    </div>

                                    {/* Bullets preview */}
                                    {m.bullets?.length > 0 && (
                                        <ul className="space-y-1 mb-3">
                                            {m.bullets.slice(0, 2).map((b, bi) => (
                                                <li key={bi} className="flex items-start gap-2 text-xs text-gray-500">
                                                    <svg className="w-3 h-3 text-[#059669] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                                                    </svg>
                                                    <span className="line-clamp-1">{b}</span>
                                                </li>
                                            ))}
                                            {m.bullets.length > 2 && (
                                                <li className="text-xs text-gray-400 pl-5">+{m.bullets.length - 2} more bullets</li>
                                            )}
                                        </ul>
                                    )}

                                    {/* Curriculum count */}
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        <span>{m.curriculum?.length ?? 0} topics · {m.curriculum?.reduce((s, sm) => s + sm.classes.length, 0) ?? 0} classes</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                                        <a
                                            href={`/dashboard/course-modules/${m.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            Preview
                                        </a>
                                        <button
                                            onClick={() => openEdit(m)}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#059669] border border-[#059669]/30 rounded-lg hover:bg-[#ecfdf5] transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleResetCurriculum(m)}
                                            disabled={resettingSlug === m.slug}
                                            title="Code থেকে curriculum আপডেট করুন"
                                            className="flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold text-amber-600 border border-amber-400 rounded-lg hover:bg-amber-50 hover:text-amber-800 transition-colors disabled:opacity-50"
                                        >
                                            {resettingSlug === m.slug ? (
                                                <span className="inline-block w-3 h-3 border-2 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" />
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            )}
                                            <span>Reset</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(m)}
                                            className="flex items-center justify-center p-2 text-red-400 border border-red-100 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminRoute>
    );
}
