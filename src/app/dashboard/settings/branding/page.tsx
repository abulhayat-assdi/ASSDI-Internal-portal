"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Globe, Image as ImageIcon, Save, CheckCircle, Upload, Trash2, Loader2, Bot } from "lucide-react";

interface TenantSettings {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    accentColor: string;
    aiKnowledge: string;
    plan: string;
}

export default function BrandingSettingsPage() {
    const [tenant, setTenant] = useState<TenantSettings | null>(null);
    const [form, setForm] = useState({
        name: "",
        tagline: "",
        primaryColor: "#1a56db",
        accentColor: "#f3f4f6",
        aiKnowledge: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingFavicon, setUploadingFavicon] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    const applyTenant = (t: TenantSettings) => {
        setTenant(t);
        setForm({
            name: t.name || "",
            tagline: t.tagline || "",
            primaryColor: t.primaryColor || "#1a56db",
            accentColor: t.accentColor || "#f3f4f6",
            aiKnowledge: t.aiKnowledge || "",
        });
    };

    useEffect(() => {
        fetch("/api/tenant/settings")
            .then((r) => r.json())
            .then((d) => {
                if (d.tenant) applyTenant(d.tenant);
                else setError(d.error || "সেটিংস লোড করা যায়নি।");
            })
            .catch(() => setError("সেটিংস লোড করা যায়নি।"))
            .finally(() => setLoading(false));
    }, []);

    /** Saves a subset of fields; used by both the Save button and the logo pickers. */
    const patch = async (body: Record<string, unknown>) => {
        const res = await fetch("/api/tenant/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "আপডেট ব্যর্থ হয়েছে।");
        applyTenant(d.tenant);
        // The sidebar caches logo/name — tell it to refetch.
        window.dispatchEvent(new Event("site-settings-changed"));
        return d.tenant as TenantSettings;
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            await patch(form);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "আপডেট ব্যর্থ হয়েছে।");
        } finally {
            setSaving(false);
        }
    };

    const uploadImage = async (
        file: File,
        field: "logoUrl" | "faviconUrl",
        setBusy: (v: boolean) => void
    ) => {
        setError("");
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("folder", `images/courses/${tenant!.id}`);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "আপলোড করা যায়নি।");
            await patch({ [field]: data.url });
        } catch (e) {
            setError(e instanceof Error ? e.message : "আপলোড করা যায়নি।");
        } finally {
            setBusy(false);
        }
    };

    const removeImage = async (field: "logoUrl" | "faviconUrl", setBusy: (v: boolean) => void) => {
        setError("");
        setBusy(true);
        try {
            await patch({ [field]: null });
        } catch (e) {
            setError(e instanceof Error ? e.message : "সরানো যায়নি।");
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <div className="p-6 text-slate-400">লোড হচ্ছে...</div>;

    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd";

    return (
        <div className="max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">ব্র্যান্ডিং ও সেটিংস</h1>
                <p className="text-slate-500 text-sm mt-1">
                    এই কোর্সের নাম, লোগো ও রং কাস্টমাইজ করুন — লগইন পেজ, সাইডবার ও ড্যাশবোর্ডে এগুলোই দেখাবে।
                </p>
            </div>

            {saved && (
                <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    সফলভাবে সেভ হয়েছে!
                </div>
            )}
            {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}

            <div className="space-y-4">
                {/* Course identity */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" /> কোর্সের পরিচয়
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">কোর্সের নাম</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                লগইন পেজ, সাইডবার আর ড্যাশবোর্ডের &ldquo;Comprehensive Portal for …&rdquo; লেখায় এই নামটাই বসবে।
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Tagline (ঐচ্ছিক)</label>
                            <input
                                type="text"
                                placeholder="আমাদের দক্ষতাই আমাদের পরিচয়"
                                value={form.tagline}
                                onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {tenant && (
                            <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500">
                                পোর্টাল URL: <span className="font-mono text-blue-600">{tenant.slug}.{baseDomain}</span>
                                <span className="ml-2 text-slate-400">(subdomain পরিবর্তন করতে super admin-কে অনুরোধ করুন)</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Logo & favicon */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-green-500" /> লোগো ও ব্রাউজার আইকন
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <p className="text-xs text-slate-500 mb-2">লোগো (সাইডবার ও লগইন পেজ)</p>
                            <div className="w-20 h-20 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden mb-2">
                                {tenant?.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={tenant.logoUrl} alt="Course logo" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <span className="text-slate-500 text-xs">নেই</span>
                                )}
                            </div>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (file) uploadImage(file, "logoUrl", setUploadingLogo);
                                }}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => logoInputRef.current?.click()}
                                    disabled={uploadingLogo || !tenant}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-60"
                                >
                                    {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                    {tenant?.logoUrl ? "পরিবর্তন" : "আপলোড"}
                                </button>
                                {tenant?.logoUrl && (
                                    <button
                                        onClick={() => removeImage("logoUrl", setUploadingLogo)}
                                        disabled={uploadingLogo}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-60"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> সরান
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-2">ব্রাউজার আইকন (ট্যাবের ফ্যাভিকন)</p>
                            <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden mb-2">
                                {tenant?.faviconUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={tenant.faviconUrl} alt="Favicon" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <span className="text-slate-400 text-xs">নেই</span>
                                )}
                            </div>
                            <input
                                ref={faviconInputRef}
                                type="file"
                                accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (file) uploadImage(file, "faviconUrl", setUploadingFavicon);
                                }}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => faviconInputRef.current?.click()}
                                    disabled={uploadingFavicon || !tenant}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-60"
                                >
                                    {uploadingFavicon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                    {tenant?.faviconUrl ? "পরিবর্তন" : "আপলোড"}
                                </button>
                                {tenant?.faviconUrl && (
                                    <button
                                        onClick={() => removeImage("faviconUrl", setUploadingFavicon)}
                                        disabled={uploadingFavicon}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-60"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> সরান
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-3">লোগো আপলোড/সরানো সঙ্গে সঙ্গেই সেভ হয়ে যায়।</p>
                </div>

                {/* Color scheme */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Palette className="w-4 h-4 text-purple-500" /> রঙের থিম
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-2">প্রাইমারি রং (বোতাম, লিঙ্ক)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={form.primaryColor}
                                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                                    className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                                />
                                <span className="text-sm font-mono text-slate-600">{form.primaryColor}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-2">অ্যাকসেন্ট রং (ব্যাকগ্রাউন্ড)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={form.accentColor}
                                    onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                                    className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                                />
                                <span className="text-sm font-mono text-slate-600">{form.accentColor}</span>
                            </div>
                        </div>
                    </div>
                    {/* Preview */}
                    <div className="mt-4 rounded-lg overflow-hidden border border-slate-200">
                        <div className="px-4 py-2 text-white text-sm font-medium" style={{ backgroundColor: form.primaryColor }}>
                            {form.name || "আপনার পোর্টাল"} — প্রিভিউ
                        </div>
                        <div className="px-4 py-3 text-sm" style={{ backgroundColor: form.accentColor }}>
                            <button className="px-3 py-1 rounded text-white text-xs" style={{ backgroundColor: form.primaryColor }}>
                                বোতাম
                            </button>
                        </div>
                    </div>
                </div>

                {/* AI assistant knowledge */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-amber-500" /> AI অ্যাসিস্ট্যান্টের তথ্য
                    </h3>
                    <p className="text-xs text-slate-500 mb-2">
                        কোর্স ফি, সময়কাল, যোগাযোগ, মডিউল তালিকা — যা লিখবেন AI অ্যাসিস্ট্যান্ট শুধু সেটুকু থেকেই উত্তর দেবে।
                        খালি রাখলে শুধু কোর্সের নাম ও tagline ব্যবহার হবে।
                    </p>
                    <textarea
                        rows={8}
                        value={form.aiKnowledge}
                        onChange={(e) => setForm((f) => ({ ...f, aiKnowledge: e.target.value }))}
                        placeholder={"- Duration: ৯০ দিন\n- Course Fee: ৭০,০০০ টাকা\n- Contact: 01xxxxxxxxx\n- Modules: ..."}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Plan info */}
                {tenant && (
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                        <h3 className="font-semibold text-slate-700 mb-2">Plan তথ্য</h3>
                        <p className="text-sm text-slate-600">
                            আপনার বর্তমান plan: <span className="capitalize font-semibold text-blue-600">{tenant.plan}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Plan পরিবর্তনের জন্য super admin-এর সাথে যোগাযোগ করুন।</p>
                    </div>
                )}
            </div>

            <div className="mt-6">
                <button
                    onClick={handleSave}
                    disabled={saving || !tenant}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition font-medium text-sm disabled:opacity-60"
                >
                    <Save className="w-4 h-4" />
                    {saving ? "সেভ হচ্ছে..." : "পরিবর্তন সেভ করুন"}
                </button>
            </div>
        </div>
    );
}
