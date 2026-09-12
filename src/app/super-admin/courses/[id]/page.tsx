"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, UserPlus, Loader2 } from "lucide-react";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd";

const FEATURE_LABELS: Record<string, string> = {
    homework: "হোমওয়ার্ক",
    resources: "Resource Library",
    course_modules: "Course Modules",
    exam_results: "পরীক্ষার ফলাফল",
    blog: "Blog",
    success_stories: "সাফল্যের গল্প",
    video_testimonials: "ভিডিও Testimonial",
    cv_builder: "CV Builder",
    daily_tracker: "Daily Tracker",
    policies: "Policy & Minutes",
    leave_tracking: "Leave Tracking",
    chat: "Chat System",
    deployments: "Student Deployments",
};

interface Course {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    status: string;
    primaryColor: string;
    accentColor: string;
    settings: { features?: Record<string, boolean> };
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

    const [newAdminName, setNewAdminName] = useState("");
    const [newAdminEmail, setNewAdminEmail] = useState("");
    const [newAdminPassword, setNewAdminPassword] = useState("");
    const [addingAdmin, setAddingAdmin] = useState(false);

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
            setFeatures(courseData.course.settings?.features || {});
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
            const res = await fetch(`/api/saas/courses/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, tagline: tagline || null, status, features }),
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

            {/* Feature toggles */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h2 className="font-semibold text-slate-800 mb-1">ফিচার অ্যাক্সেস</h2>
                <p className="text-xs text-slate-400 mb-4">এই কোর্সের ড্যাশবোর্ডে কোন ফিচারগুলো দেখা যাবে তা নিয়ন্ত্রণ করুন।</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm text-slate-700 py-1">
                            <input
                                type="checkbox"
                                checked={features[key] !== false}
                                onChange={(e) => setFeatures((prev) => ({ ...prev, [key]: e.target.checked }))}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
                {saving ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}
            </button>

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
