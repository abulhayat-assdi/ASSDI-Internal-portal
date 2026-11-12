"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { DEFAULT_EMAIL_ALERT_SETTINGS, type EmailAlertSettings } from "@/lib/emailAlerts/settingsSchema";

interface LogRow {
    id: string;
    kind: string;
    recipients: string[];
    subject: string;
    status: string;
    error: string | null;
    createdAt: string;
}

const KIND_LABELS: Record<string, string> = {
    leave_new: "নতুন ছুটির আবেদন",
    leave_confirm: "ছাত্রকে রিসিপ্ট",
    leave_pending: "অপেক্ষমাণ রিমাইন্ডার",
    on_leave_today: "আজ ছুটিতে",
    correction_new: "হাজিরা সংশোধন",
    streak_late: "পরপর লেট",
    streak_absent: "পরপর অনুপস্থিত",
    streak_escalation: "স্টাফকে এসকেলেশন",
    streak_guardian: "অভিভাবককে",
};

type BoolKey = {
    [K in keyof EmailAlertSettings]: EmailAlertSettings[K] extends boolean ? K : never;
}[keyof EmailAlertSettings];
type NumKey = {
    [K in keyof EmailAlertSettings]: EmailAlertSettings[K] extends number ? K : never;
}[keyof EmailAlertSettings];

function when(iso: string) {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function EmailAlertsPage() {
    const [settings, setSettings] = useState<EmailAlertSettings>(DEFAULT_EMAIL_ALERT_SETTINGS);
    const [recipientsText, setRecipientsText] = useState("");
    const [mailConfigured, setMailConfigured] = useState(true);
    const [featureEnabled, setFeatureEnabled] = useState(true);
    const [logs, setLogs] = useState<LogRow[]>([]);
    const [kindFilter, setKindFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testTo, setTestTo] = useState("");
    const [testing, setTesting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/email-alerts?limit=200${kindFilter ? `&kind=${kindFilter}` : ""}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "লোড করা যায়নি।");
            setSettings(data.settings);
            setRecipientsText((data.settings.staffRecipients as string[]).join("\n"));
            setMailConfigured(data.mailConfigured);
            setFeatureEnabled(data.featureEnabled);
            setLogs(data.logs);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, [kindFilter]);

    useEffect(() => {
        load();
    }, [load]);

    const setBool = (key: BoolKey, value: boolean) => setSettings((s) => ({ ...s, [key]: value }));
    const setNum = (key: NumKey, value: number) => setSettings((s) => ({ ...s, [key]: value }));

    const save = async () => {
        const staffRecipients = recipientsText
            .split(/[\s,;]+/)
            .map((e) => e.trim())
            .filter(Boolean);
        setSaving(true);
        try {
            const res = await fetch("/api/admin/email-alerts", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...settings, staffRecipients }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "সেভ করা যায়নি।");
            setSettings(data.settings);
            setRecipientsText(data.settings.staffRecipients.join("\n"));
            toast.success("সেটিংস সেভ হয়েছে");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "সেভ করা যায়নি।");
        } finally {
            setSaving(false);
        }
    };

    const sendTest = async () => {
        setTesting(true);
        try {
            const res = await fetch("/api/admin/email-alerts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: testTo }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "পাঠানো যায়নি।");
            toast.success("টেস্ট মেইল পাঠানো হয়েছে");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "পাঠানো যায়নি।");
        } finally {
            setTesting(false);
        }
    };

    const toggle = (k: BoolKey, label: string, hint?: string) => (
        <label key={k} className="flex items-start gap-3 py-2 cursor-pointer">
            <input
                type="checkbox"
                checked={settings[k]}
                onChange={(e) => setBool(k, e.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span>
                <span className="text-sm font-medium text-slate-700">{label}</span>
                {hint && <span className="block text-xs text-slate-500">{hint}</span>}
            </span>
        </label>
    );

    const numberField = (k: NumKey, label: string, min: number, max: number) => (
        <label key={k} className="flex items-center gap-2 text-sm text-slate-600 pl-7 pb-2">
            {label}
            <input
                type="number"
                min={min}
                max={max}
                value={settings[k]}
                onChange={(e) => setNum(k, Math.min(max, Math.max(min, Number(e.target.value) || min)))}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
        </label>
    );

    const card = "bg-white rounded-xl border border-slate-100 shadow-sm p-5";

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Email Alerts</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        ছুটির আবেদন আর পরপর লেট/অনুপস্থিতির স্বয়ংক্রিয় ইমেইল। দৈনিক মেইলগুলো প্রতিদিন সকাল ৭টায় (বাংলাদেশ সময়) যায়।
                    </p>
                </div>
                <Link href="/dashboard/student-leaves" className="text-sm text-emerald-700 hover:underline">
                    ← Student Leaves
                </Link>
            </div>

            {!loading && (!mailConfigured || !featureEnabled) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
                    {!mailConfigured && <p>সার্ভারে SMTP সেট করা নেই, তাই কোনো মেইল যাবে না।</p>}
                    {!featureEnabled && (
                        <p>
                            এই কোর্সে <strong>Email Notifications</strong> ফিচার বন্ধ। সুপার অ্যাডমিন চালু না করা পর্যন্ত কোনো মেইল যাবে না।
                        </p>
                    )}
                </div>
            )}

            <section className={card}>
                <h2 className="font-semibold text-slate-800">স্টাফ ইমেইল ঠিকানা</h2>
                <p className="text-xs text-slate-500 mt-1 mb-3">
                    নতুন ছুটির আবেদন, রিমাইন্ডার, &quot;আজ ছুটিতে&quot; তালিকা, হাজিরা সংশোধনের আবেদন আর এসকেলেশন এই ঠিকানাগুলোতে যাবে।
                    প্রতি লাইনে একটি (সর্বোচ্চ ২০টি)।
                </p>
                <textarea
                    value={recipientsText}
                    onChange={(e) => setRecipientsText(e.target.value)}
                    rows={4}
                    placeholder={"office@example.com\nprincipal@example.com"}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                />
                {!loading && settings.staffRecipients.length === 0 && (
                    <p className="text-xs text-amber-700 mt-1">কোনো ঠিকানা না থাকলে স্টাফদের কাছে কোনো মেইল যাবে না।</p>
                )}
            </section>

            <section className={card}>
                <h2 className="font-semibold text-slate-800 mb-1">ছুটির আবেদন</h2>
                {toggle("leaveNewToStaff", "নতুন আবেদন এলে স্টাফকে মেইল", "সাথে সাথে যায়।")}
                {toggle("leaveConfirmToStudent", "আবেদন জমা হলে ছাত্রকে রিসিপ্ট")}
                {toggle("leavePendingReminder", "অপেক্ষমাণ আবেদনের দৈনিক রিমাইন্ডার")}
                {numberField("pendingReminderHours", "কত ঘণ্টা অপেক্ষমাণ থাকলে:", 1, 168)}
                {toggle("onLeaveTodayDigest", 'প্রতিদিন সকালে "আজ যারা ছুটিতে" তালিকা')}
                {toggle("correctionNewToStaff", "হাজিরা সংশোধনের নতুন আবেদন এলে স্টাফকে মেইল")}
            </section>

            <section className={card}>
                <h2 className="font-semibold text-slate-800 mb-1">পরপর লেট / অনুপস্থিতি</h2>
                <p className="text-xs text-slate-500 mb-2">
                    ব্যাচের রোল কলের দিন ধরে গোনা হয়। ছুটি (On Leave) বা মঞ্জুর হওয়া ছুটির দিন গোনায় ধরা হয় না, ধারাবাহিকতাও ভাঙে না।
                    একই ধারাবাহিকতার জন্য একবারই মেইল যায়।
                </p>
                {toggle("lateStreakToStudent", "পরপর লেট হলে ছাত্রকে মেইল")}
                {numberField("lateStreakDays", "পরপর কত দিন:", 2, 10)}
                {toggle("absentStreakToStudent", "পরপর অনুপস্থিত হলে ছাত্রকে মেইল")}
                {numberField("absentStreakDays", "পরপর কত দিন:", 2, 10)}
                {toggle("escalationToStaff", "বেশি দিন অনুপস্থিত হলে স্টাফকে মেইল")}
                {toggle("escalationToGuardian", "বেশি দিন অনুপস্থিত হলে অভিভাবককে মেইল", "ছাত্রের তথ্যে অভিভাবকের ইমেইল থাকলে তবেই যাবে।")}
                {numberField("escalationDays", "পরপর কত দিন অনুপস্থিত হলে:", 2, 15)}
            </section>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={save}
                    disabled={saving || loading}
                    className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                    {saving ? "সেভ হচ্ছে..." : "সেটিংস সেভ করুন"}
                </button>
                <div className="flex items-center gap-2">
                    <input
                        type="email"
                        value={testTo}
                        onChange={(e) => setTestTo(e.target.value)}
                        placeholder="test@example.com"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                        onClick={sendTest}
                        disabled={testing || !testTo}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {testing ? "পাঠানো হচ্ছে..." : "টেস্ট মেইল"}
                    </button>
                </div>
            </div>

            <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h2 className="font-semibold text-slate-800">পাঠানো মেইলের লগ</h2>
                    <select
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    >
                        <option value="">সব ধরন</option>
                        {Object.entries(KIND_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </div>
                {loading ? (
                    <p className="text-sm text-slate-400 py-6 text-center">লোড হচ্ছে...</p>
                ) : logs.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">এখনো কোনো মেইল যায়নি।</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-100">
                                    <th className="py-2 pr-3 font-medium">সময়</th>
                                    <th className="py-2 pr-3 font-medium">ধরন</th>
                                    <th className="py-2 pr-3 font-medium">বিষয়</th>
                                    <th className="py-2 pr-3 font-medium">প্রাপক</th>
                                    <th className="py-2 font-medium">অবস্থা</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((l) => (
                                    <tr key={l.id} className="border-b border-slate-50 align-top">
                                        <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{when(l.createdAt)}</td>
                                        <td className="py-2 pr-3 whitespace-nowrap">{KIND_LABELS[l.kind] ?? l.kind}</td>
                                        <td className="py-2 pr-3">{l.subject}</td>
                                        <td className="py-2 pr-3 text-xs text-slate-500 break-all">{l.recipients.join(", ")}</td>
                                        <td className="py-2">
                                            <span
                                                title={l.error ?? undefined}
                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    l.status === "SENT" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                                }`}
                                            >
                                                {l.status === "SENT" ? "পাঠানো" : "ব্যর্থ"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
