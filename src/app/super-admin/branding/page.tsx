"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Loader2, ImageIcon, Globe } from "lucide-react";

type Field = "logoUrl" | "faviconUrl";

interface PlatformSettings {
    logoUrl: string | null;
    faviconUrl: string | null;
}

export default function PlatformBrandingPage() {
    const [settings, setSettings] = useState<PlatformSettings>({ logoUrl: null, faviconUrl: null });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<Field | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/saas/platform-settings")
            .then((r) => r.json())
            .then((d) => {
                if (d.settings) setSettings(d.settings);
                else setError(d.error || "সেটিংস লোড করা যায়নি।");
            })
            .catch(() => setError("সেটিংস লোড করা যায়নি।"))
            .finally(() => setLoading(false));
    }, []);

    const save = async (field: Field, value: string | null) => {
        const res = await fetch("/api/saas/platform-settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "সেভ করা যায়নি।");
        setSettings(d.settings);
    };

    const upload = async (file: File, field: Field) => {
        setError("");
        setMessage("");
        setBusy(field);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("folder", "images/logo");
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "আপলোড করা যায়নি।");
            await save(field, data.url);
            setMessage(field === "logoUrl" ? "গ্লোবাল লোগো সেভ হয়েছে।" : "ব্রাউজার আইকন সেভ হয়েছে।");
        } catch (e) {
            setError(e instanceof Error ? e.message : "আপলোড করা যায়নি।");
        } finally {
            setBusy(null);
        }
    };

    const remove = async (field: Field) => {
        setError("");
        setMessage("");
        setBusy(field);
        try {
            await save(field, null);
            setMessage("সরানো হয়েছে।");
        } catch (e) {
            setError(e instanceof Error ? e.message : "সরানো যায়নি।");
        } finally {
            setBusy(null);
        }
    };

    if (loading) return <div className="max-w-3xl mx-auto px-6 py-8 text-slate-400">লোড হচ্ছে...</div>;

    const cards: {
        field: Field;
        title: string;
        help: string;
        accept: string;
        inputRef: React.RefObject<HTMLInputElement | null>;
        previewClass: string;
        icon: React.ReactNode;
    }[] = [
        {
            field: "logoUrl",
            title: "প্রতিষ্ঠানের লোগো",
            help: "মূল ডোমেইনের কোর্স তালিকা পেজে দেখাবে। যে কোর্সে আলাদা লোগো আপলোড করা নেই, সেই কোর্সের সাইডবার ও লগইন পেজেও এটাই দেখাবে। 512×512 PNG/WebP সুপারিশকৃত।",
            accept: "image/png,image/jpeg,image/webp,image/gif",
            inputRef: logoInputRef,
            previewClass: "bg-white p-2",
            icon: <ImageIcon className="w-4 h-4 text-indigo-500" />,
        },
        {
            field: "faviconUrl",
            title: "ব্রাউজার আইকন (Favicon)",
            help: "ব্রাউজার ট্যাবে দেখাবে। যে কোর্সে আলাদা আইকন বা লোগো নেই, সেখানেও এটাই ব্যবহার হবে। আপলোড না করলে প্রতিষ্ঠানের লোগোই আইকন হবে। 64×64 বা তার বেশি PNG/ICO সুপারিশকৃত।",
            accept: "image/png,image/x-icon,image/vnd.microsoft.icon,image/webp,image/jpeg,.ico",
            inputRef: faviconInputRef,
            previewClass: "bg-slate-50 p-3",
            icon: <Globe className="w-4 h-4 text-emerald-500" />,
        },
    ];

    return (
        <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">গ্লোবাল ব্র্যান্ডিং</h1>
                <p className="text-slate-500 text-sm mt-1">
                    পুরো প্রতিষ্ঠানের লোগো ও ব্রাউজার আইকন। আপলোড বা সরানো সঙ্গে সঙ্গেই সেভ হয়ে যায়।
                </p>
            </div>

            {message && <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm">{message}</div>}
            {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}

            <div className="space-y-4">
                {cards.map((c) => {
                    const url = settings[c.field];
                    const isBusy = busy === c.field;
                    return (
                        <div key={c.field} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                            <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                {c.icon} {c.title}
                            </h2>
                            <div className="flex items-center gap-4">
                                <div className={`w-24 h-24 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 ${c.previewClass}`}>
                                    {url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={url} alt={c.title} className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-slate-400 text-xs">নেই</span>
                                    )}
                                </div>
                                <div>
                                    <input
                                        ref={c.inputRef}
                                        type="file"
                                        accept={c.accept}
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = "";
                                            if (file) upload(file, c.field);
                                        }}
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => c.inputRef.current?.click()}
                                            disabled={busy !== null}
                                            className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                        >
                                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            {url ? "পরিবর্তন করুন" : "আপলোড করুন"}
                                        </button>
                                        {url && (
                                            <button
                                                type="button"
                                                onClick={() => remove(c.field)}
                                                disabled={busy !== null}
                                                className="flex items-center gap-1.5 text-sm text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 className="w-4 h-4" /> সরান
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2 max-w-md">{c.help}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="text-xs text-slate-400 mt-4">
                ব্রাউজার আইকন ক্যাশ হয়, তাই পরিবর্তন ট্যাবে দেখতে পেজ রিফ্রেশ (Ctrl+Shift+R) করতে হতে পারে।
            </p>
        </div>
    );
}
