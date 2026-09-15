"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, UserPlus, Loader2, Upload, X, KeyRound } from "lucide-react";
import { ALL_FEATURES, getTenantFeatures } from "@/lib/features";
import { BILLING_PLANS, getBilling, billingDaysLeft, type BillingPlan } from "@/lib/billing";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd";

interface Course {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    logoUrl: string | null;
    status: string;
    primaryColor: string;
    accentColor: string;
    settings: { features?: Record<string, boolean>; billing?: Record<string, unknown> };
}

interface Stats {
    studentCount: number;
    teacherCount: number;
    adminCount: number;
    batchCount: number;
}

interface Admin {
    id: string;
    email: string;
    displayName: string;
    lastLoginAt: string | null;
    createdAt: string;
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [course, setCourse] = useState<Course | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const [name, setName] = useState("");
    const [tagline, setTagline] = useState("");
    const [status, setStatus] = useState("ACTIVE");
    const [features, setFeatures] = useState<Record<string, boolean>>({});
    const [plan, setPlan] = useState<BillingPlan>("trial");
    const [expiresAt, setExpiresAt] = useState("");
    const [maxStudents, setMaxStudents] = useState("");
    const [maxTeachers, setMaxTeachers] = useState("");
    const [billingNotes, setBillingNotes] = useState("");
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [newAdminName, setNewAdminName] = useState("");
    const [newAdminEmail, setNewAdminEmail] = useState("");
    const [newAdminPassword, setNewAdminPassword] = useState("");
    const [addingAdmin, setAddingAdmin] = useState(false);
    const [impersonateUserId, setImpersonateUserId] = useState("");
    const [impersonating, setImpersonating] = useState(false);

    const load = useCallback(async () => {
        const [courseRes, adminsRes] = await Promise.all([
            fetch(`/api/saas/courses/${id}`),
            fetch(`/api/saas/courses/${id}/admins`),
        ]);
        const courseData = await courseRes.json();
        const adminsData = await adminsRes.json();

        if (courseRes.ok) {
            setCourse(courseData.course);
            setStats(courseData.stats);
            setName(courseData.course.name);
            setTagline(courseData.course.tagline || "");
            setStatus(courseData.course.status);
            // getTenantFeatures দিয়ে resolved defaults সহ লোড করি, যাতে
            // নতুন ফিচার OFF আর পুরনো ফিচার ON অবস্থায় সঠিকভাবে দেখায়।
            setFeatures(getTenantFeatures(courseData.course.settings));
            const b = getBilling(courseData.course.settings);
            setPlan(b.plan);
            setExpiresAt(b.expiresAt ? b.expiresAt.slice(0, 10) : "");
            setMaxStudents(b.maxStudents != null ? String(b.maxStudents) : "");
            setMaxTeachers(b.maxTeachers != null ? String(b.maxTeachers) : "");
            setBillingNotes(b.notes || "");
        }
        if (adminsRes.ok) setAdmins(adminsData.admins || []);
        setLoading(false);
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const billing = {
                plan,
                expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null,
                maxStudents: maxStudents === "" ? null : Math.max(0, parseInt(maxStudents, 10) || 0),
                maxTeachers: maxTeachers === "" ? null : Math.max(0, parseInt(maxTeachers, 10) || 0),
                notes: billingNotes,
            };
            const res = await fetch(`/api/saas/courses/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, tagline: tagline || null, status, features, billing }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "সংরক্ষণ করা যায়নি।");
            setCourse(data.course);
            setMessage("সংরক্ষণ হয়েছে।");
        } catch (err) {
            setError(err instanceof Error ? err.message : "সংরক্ষণ করা যায়নি।");
        } finally {
            setSaving(false);
        }
    };

    const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setError("");
        setMessage("");
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", `images/courses/${id}`);
            const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData.error || "লোগো আপলোড করা যায়নি।");

            const patchRes = await fetch(`/api/saas/courses/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logoUrl: uploadData.url }),
            });
            const patchData = await patchRes.json();
            if (!patchRes.ok) throw new Error(patchData.error || "লোগো সংরক্ষণ করা যায়নি।");

            setCourse(patchData.course);
            setMessage("লোগো আপলোড হয়েছে।");
        } catch (err) {
            setError(err instanceof Error ? err.message : "লোগো আপলোড করা যায়নি।");
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleRemoveLogo = async () => {
        setError("");
        setMessage("");
        setUploadingLogo(true);
        try {
            const res = await fetch(`/api/saas/courses/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logoUrl: null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "লোগো সরানো যায়নি।");
            setCourse(data.course);
            setMessage("লোগো সরানো হয়েছে।");
        } catch (err) {
            setError(err instanceof Error ? err.message : "লোগো সরানো যায়নি।");
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!newAdminName || !newAdminEmail || !newAdminPassword) {
            setError("অ্যাডমিনের নাম, ইমেইল ও পাসওয়ার্ড আবশ্যক।");
            return;
        }
        setAddingAdmin(true);
        try {
            const res = await fetch(`/api/saas/courses/${id}/admins`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newAdminName, email: newAdminEmail, password: newAdminPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "অ্যাডমিন যোগ করা যায়নি।");
            setAdmins((prev) => [...prev, data.admin]);
            setNewAdminName(""); setNewAdminEmail(""); setNewAdminPassword("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "অ্যাডমিন যোগ করা যায়নি।");
        } finally {
            setAddingAdmin(false);
        }
    };

    const handleRevokeAdmin = async (userId: string) => {
        if (!confirm("এই অ্যাডমিনের অ্যাক্সেস বাতিল করতে চান?")) return;
        await fetch(`/api/saas/courses/${id}/admins?userId=${userId}`, { method: "DELETE" });
        setAdmins((prev) => prev.filter((a) => a.id !== userId));
    };

    const handleLoginAsAdmin = async () => {
        if (!course) return;
        setError("");
        setMessage("");
        setImpersonating(true);
        try {
            const res = await fetch(`/api/saas/courses/${id}/impersonate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(impersonateUserId ? { userId: impersonateUserId } : {}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "লগইন লিংক তৈরি করা যায়নি।");

            // Same deployment, sibling subdomain: admin.<base> → <slug>.<base>
            // (port/protocol preserved, so localhost-ও কাজ করে)
            const u = new URL(window.location.href);
            const host = u.hostname.replace(/^[^.]+/, data.slug);
            const target = `${u.protocol}//${host}${u.port ? `:${u.port}` : ""}/api/auth/impersonate?token=${encodeURIComponent(data.token)}`;
            window.open(target, "_blank", "noopener");
            setMessage(`${data.targetEmail} হিসেবে পোর্টাল নতুন ট্যাবে খুলছে…`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "লগইন করা যায়নি।");
        } finally {
            setImpersonating(false);
        }
    };

    const handleDeleteCourse = async () => {
        if (!course) return;
        const confirmed = prompt(`এই কোর্স ও এর ভেতরের সব ডেটা (ছাত্র, শিক্ষক, সবকিছু) স্থায়ীভাবে মুছে যাবে। নিশ্চিত হলে কোর্সের নাম টাইপ করুন: "${course.name}"`);
        if (confirmed !== course.name) return;

        const res = await fetch(`/api/saas/courses/${id}`, { method: "DELETE" });
        if (res.ok) {
            router.push("/super-admin");
        } else {
            const data = await res.json();
            setError(data.error || "কোর্স মুছে ফেলা যায়নি।");
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400">লোড হচ্ছে...</div>;
    }
    if (!course) {
        return <div className="p-8 text-center text-slate-400">কোর্স খুঁজে পাওয়া যায়নি।</div>;
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <Link href="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-4 h-4" />
                সব কোর্স
            </Link>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
            )}
            {message && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">{message}</div>
            )}

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        ["শিক্ষার্থী", stats.studentCount],
                        ["শিক্ষক", stats.teacherCount],
                        ["অ্যাডমিন", stats.adminCount],
                        ["ব্যাচ", stats.batchCount],
                    ].map(([label, value]) => (
                        <div key={label as string} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
                            <p className="text-2xl font-bold text-slate-800">{value}</p>
                            <p className="text-xs text-slate-500 mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Basic info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-semibold text-slate-800 mb-1">{course.name}</h2>
                <a
                    href={`https://${course.slug}.${BASE_DOMAIN}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline"
                >
                    {course.slug}.{BASE_DOMAIN}
                </a>

                <div className="mt-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">কোর্স লোগো</label>
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                {course.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={course.logoUrl} alt={`${course.name} logo`} className="w-full h-full object-contain" />
                                ) : (
                                    <Upload className="w-5 h-5 text-slate-300" />
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                                    onChange={handleLogoSelect}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingLogo}
                                    className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    {course.logoUrl ? "লোগো পরিবর্তন করুন" : "লোগো আপলোড করুন"}
                                </button>
                                {course.logoUrl && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveLogo}
                                        disabled={uploadingLogo}
                                        className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                        title="লোগো সরিয়ে ফেলুন"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">কোর্সের নাম</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">ট্যাগলাইন</label>
                        <input
                            type="text"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">স্ট্যাটাস</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                            <option value="ACTIVE">Active</option>
                            <option value="TRIAL">Trial</option>
                            <option value="SUSPENDED">Suspended</option>
                            <option value="ARCHIVED">Archived</option>
                        </select>
                        <p className="text-xs text-slate-400 mt-1">Suspended/Archived হলে এই কোর্সের সাবডোমেইন আর অ্যাক্সেস করা যাবে না।</p>
                    </div>
                </div>
            </div>

            {/* Plan & billing */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-semibold text-slate-800 mb-1">প্ল্যান ও বিলিং</h2>
                <p className="text-xs text-slate-400 mb-4">
                    মেয়াদ শেষ হলে কোর্সের সাবডোমেইন Suspended-এর মতো বন্ধ হয়ে যাবে। সিট খালি রাখলে unlimited।
                    {(() => {
                        const d = billingDaysLeft({ billing: { plan, expiresAt: expiresAt || null } });
                        if (d == null) return " (মেয়াদ: আজীবন/আনলিমিটেড)";
                        return d < 0 ? ` (মেয়াদ শেষ ${-d} দিন আগে!)` : ` (আর ${d} দিন বাকি)`;
                    })()}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">প্ল্যান</label>
                        <select value={plan} onChange={(e) => setPlan(e.target.value as BillingPlan)} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm">
                            {BILLING_PLANS.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">মেয়াদ শেষ (Expires)</label>
                        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={plan === "lifetime"} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">সর্বোচ্চ শিক্ষার্থী</label>
                        <input type="number" min={0} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} placeholder="Unlimited" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">সর্বোচ্চ শিক্ষক</label>
                        <input type="number" min={0} value={maxTeachers} onChange={(e) => setMaxTeachers(e.target.value)} placeholder="Unlimited" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">পেমেন্ট নোট (bKash trx, মাস ইত্যাদি)</label>
                        <textarea value={billingNotes} onChange={(e) => setBillingNotes(e.target.value)} rows={2} placeholder="যেমন: Jan–Mar paid, TrxID 9HX…" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                </div>
            </div>

            {/* Feature toggles */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-semibold text-slate-800 mb-1">ফিচার অ্যাক্সেস</h2>
                <p className="text-xs text-slate-400 mb-4">এই কোর্সের টিচার/অ্যাডমিন ও স্টুডেন্ট ড্যাশবোর্ডে কোন ফিচারগুলো দেখা যাবে তা নিয়ন্ত্রণ করুন। বন্ধ থাকা ফিচার সাইডবারে দেখাবে না। নতুন ফিচার ডিফল্টভাবে বন্ধ থাকে — চালু করতে টগল অন করুন।</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_FEATURES.map((f) => {
                        const enabled = features[f.key] ?? f.defaultEnabled ?? false;
                        return (
                            <label key={f.key} className="flex items-start gap-2.5 text-sm text-slate-700 py-1.5 px-2 rounded-lg hover:bg-slate-50 cursor-pointer" title={f.description}>
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={(e) => setFeatures((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                                />
                                <span>
                                    <span className="block font-medium">{f.label}</span>
                                    <span className="block text-xs text-slate-400">{f.description}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
                {saving ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}
            </button>

            {/* Portal access — passwordless login as this course's admin */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-semibold text-slate-800 mb-1">পোর্টাল অ্যাক্সেস</h2>
                <p className="text-xs text-slate-400 mb-4">
                    ইমেইল/পাসওয়ার্ড ছাড়াই এই কোর্সের অ্যাডমিন হিসেবে পোর্টালে ঢুকুন। লিংক ৫ মিনিটের জন্য valid ও একবারই ব্যবহারযোগ্য — সব অ্যাক্সেস audit log-এ রেকর্ড হয়।
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                    {admins.length > 1 && (
                        <select
                            value={impersonateUserId}
                            onChange={(e) => setImpersonateUserId(e.target.value)}
                            className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm flex-1"
                        >
                            <option value="">ডিফল্ট অ্যাডমিন ({admins[0]?.email})</option>
                            {admins.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.displayName} — {a.email}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={handleLoginAsAdmin}
                        disabled={impersonating || admins.length === 0}
                        className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 shrink-0"
                    >
                        {impersonating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        {impersonating ? "খুলছে..." : "Login as Admin"}
                    </button>
                </div>
                {admins.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">প্রথমে নিচে একজন অ্যাডমিন যোগ করুন, তারপর এই বাটন কাজ করবে।</p>
                )}
            </div>

            {/* Admins */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-semibold text-slate-800 mb-4">অ্যাডমিন</h2>

                <div className="space-y-2 mb-5">
                    {admins.length === 0 && (
                        <p className="text-sm text-slate-400">এখনো কোনো অ্যাডমিন নেই।</p>
                    )}
                    {admins.map((a) => (
                        <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                            <div>
                                <p className="text-sm font-medium text-slate-800">{a.displayName}</p>
                                <p className="text-xs text-slate-500">{a.email}</p>
                            </div>
                            <button
                                onClick={() => handleRevokeAdmin(a.id)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="অ্যাক্সেস বাতিল করুন"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                        type="text"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        placeholder="নাম"
                        className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="ইমেইল"
                        className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="পাসওয়ার্ড"
                        className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={addingAdmin}
                        className="flex items-center justify-center gap-1.5 bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                    >
                        {addingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        অ্যাডমিন যোগ করুন
                    </button>
                </form>
            </div>

            {/* Danger zone */}
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
                <h2 className="font-semibold text-red-700 mb-1">বিপজ্জনক অঞ্চল</h2>
                <p className="text-xs text-slate-500 mb-4">কোর্স মুছে ফেললে এর ভেতরের সব ডেটা (ছাত্র, শিক্ষক, হোমওয়ার্ক — সবকিছু) স্থায়ীভাবে মুছে যাবে। এটা ফিরিয়ে আনা যাবে না।</p>
                <button
                    onClick={handleDeleteCourse}
                    className="flex items-center gap-1.5 text-red-600 border border-red-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                    কোর্স স্থায়ীভাবে মুছুন
                </button>
            </div>
        </div>
    );
}
