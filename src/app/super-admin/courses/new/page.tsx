"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, X } from "lucide-react";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd";

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

export default function NewCoursePage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [tagline, setTagline] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [faviconUrl, setFaviconUrl] = useState("");
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingFavicon, setUploadingFavicon] = useState(false);
    const [adminName, setAdminName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setError("");
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", "images/courses");
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "লোগো আপলোড করা যায়নি।");
            setLogoUrl(data.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "লোগো আপলোড করা যায়নি।");
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleFaviconSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setError("");
        setUploadingFavicon(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", "images/courses");
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "ফ্যাভিকন আপলোড করা যায়নি।");
            setFaviconUrl(data.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "ফ্যাভিকন আপলোড করা যায়নি।");
        } finally {
            setUploadingFavicon(false);
        }
    };

    const handleNameChange = (value: string) => {
        setName(value);
        if (!slugTouched) setSlug(slugify(value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!name.trim() || !slug.trim()) {
            setError("কোর্সের নাম ও সাবডোমেইন আবশ্যক।");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/saas/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    tagline: tagline.trim() || undefined,
                    logoUrl: logoUrl || undefined,
                    faviconUrl: faviconUrl || undefined,
                    ...(adminName && adminEmail && adminPassword
                        ? { adminName: adminName.trim(), adminEmail: adminEmail.trim(), adminPassword }
                        : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "কোর্স তৈরি করা যায়নি।");

            router.push(`/super-admin/courses/${data.course.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "কোর্স তৈরি করা যায়নি।");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <Link href="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" />
                সব কোর্স
            </Link>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h1 className="text-xl font-bold text-slate-800 mb-6">নতুন কোর্স তৈরি করুন</h1>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">কোর্সের নাম</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="যেমন: Web Development Bootcamp"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">সাবডোমেইন</label>
                        <div className="flex items-center">
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                                placeholder="web-dev"
                                className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            />
                            <span className="px-3.5 py-2.5 bg-slate-50 border border-l-0 border-slate-300 rounded-r-lg text-sm text-slate-500 whitespace-nowrap">
                                .{BASE_DOMAIN}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">ট্যাগলাইন (ঐচ্ছিক)</label>
                        <input
                            type="text"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            placeholder="এক লাইনে কোর্সের পরিচিতি"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">কোর্স লোগো (ঐচ্ছিক)</label>
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                {logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={logoUrl} alt="Course logo" className="w-full h-full object-contain" />
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
                                    {logoUrl ? "লোগো পরিবর্তন করুন" : "লোগো আপলোড করুন"}
                                </button>
                                {logoUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setLogoUrl("")}
                                        className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                        title="লোগো সরিয়ে ফেলুন"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">ব্রাউজার আইকন (Favicon, ঐচ্ছিক)</label>
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                {faviconUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={faviconUrl} alt="Favicon" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <span className="text-xl">🌐</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={faviconInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon,.ico"
                                    onChange={handleFaviconSelect}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => faviconInputRef.current?.click()}
                                    disabled={uploadingFavicon}
                                    className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    {uploadingFavicon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    {faviconUrl ? "আইকন পরিবর্তন করুন" : "আইকন আপলোড করুন"}
                                </button>
                                {faviconUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setFaviconUrl("")}
                                        className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                        title="আইকন সরিয়ে ফেলুন"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">ব্রাউজার ট্যাবে দেখাবে। ICO বা 32×32 PNG দিন।</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-sm font-medium text-slate-700 mb-1">প্রথম অ্যাডমিন (ঐচ্ছিক)</p>
                        <p className="text-xs text-slate-400 mb-3">এখন না দিলে পরে কোর্স পেজ থেকে যোগ করতে পারবেন।</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                                type="text"
                                value={adminName}
                                onChange={(e) => setAdminName(e.target.value)}
                                placeholder="নাম"
                                className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            />
                            <input
                                type="email"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                placeholder="ইমেইল"
                                className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            />
                            <input
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="পাসওয়ার্ড"
                                className="px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:col-span-2"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "তৈরি হচ্ছে..." : "কোর্স তৈরি করুন"}
                    </button>
                </form>
            </div>
        </div>
    );
}
