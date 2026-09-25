"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface RollLock {
    batchName: string;
    roll: string;
    registeredEmail: string | null;
    unlocked: boolean;
    accessBlockedAt: string | null;
}

/**
 * Who has claimed which roll number, and the admin's one-shot escape hatch.
 *
 * A roll can be registered once. When a student loses access to the email
 * they signed up with, an admin reopens that roll here; the next registration
 * spends the permission and locks it again.
 */
export default function RegistrationLockPanel({ batchName }: { batchName: string }) {
    const [rolls, setRolls] = useState<RollLock[]>([]);
    const [loading, setLoading] = useState(false);
    const [busyRoll, setBusyRoll] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    const load = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        try {
            const params = batchName && batchName !== "all" ? `?batchName=${encodeURIComponent(batchName)}` : "";
            const res = await fetch(`/api/batch-info/registration-lock${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "লোড করা যায়নি।");
            setRolls(data.rolls);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, [batchName, open]);

    useEffect(() => {
        load();
    }, [load]);

    const toggle = async (row: RollLock) => {
        const key = `${row.batchName}::${row.roll}`;
        setBusyRoll(key);
        try {
            const res = await fetch("/api/batch-info/registration-lock", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    batchName: row.batchName,
                    roll: row.roll,
                    unlocked: !row.unlocked,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "পরিবর্তন করা যায়নি।");
            setRolls((list) =>
                list.map((r) =>
                    r.batchName === row.batchName && r.roll === row.roll
                        ? { ...r, unlocked: data.student.registrationUnlocked }
                        : r
                )
            );
            toast.success(
                data.student.registrationUnlocked
                    ? `রোল ${row.roll} — একবার রি-রেজিস্টার করার অনুমতি দেওয়া হলো।`
                    : `রোল ${row.roll} — অনুমতি বাতিল।`
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "পরিবর্তন করা যায়নি।");
        } finally {
            setBusyRoll(null);
        }
    };

    const claimed = rolls.filter((r) => r.registeredEmail);
    const unlockedCount = rolls.filter((r) => r.unlocked).length;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
                <span>
                    <span className="font-bold text-[#1f2937]">রেজিস্ট্রেশন লক</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                        কোন রোল কোন ইমেইলে নেওয়া হয়েছে, আর কাকে আবার রেজিস্টার করার অনুমতি দেওয়া আছে
                        {unlockedCount > 0 && (
                            <span className="ml-2 text-amber-600 font-semibold">
                                {unlockedCount}টি খোলা আছে
                            </span>
                        )}
                    </span>
                </span>
                <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
            </button>

            {open && (
                <div className="border-t border-gray-100 px-6 py-4">
                    {loading ? (
                        <p className="text-sm text-gray-400 py-4 text-center">লোড হচ্ছে...</p>
                    ) : claimed.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">
                            এই ব্যাচে এখনো কেউ রেজিস্টার করেনি।
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="text-left py-2">ব্যাচ</th>
                                        <th className="text-left py-2">রোল</th>
                                        <th className="text-left py-2">যে ইমেইলে নেওয়া</th>
                                        <th className="text-left py-2">অবস্থা</th>
                                        <th className="text-right py-2">অনুমতি</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {claimed.map((r) => {
                                        const key = `${r.batchName}::${r.roll}`;
                                        return (
                                            <tr key={key}>
                                                <td className="py-2 text-gray-500">{r.batchName}</td>
                                                <td className="py-2 font-mono text-xs text-gray-600">{r.roll}</td>
                                                <td className="py-2 text-gray-700">{r.registeredEmail}</td>
                                                <td className="py-2">
                                                    {r.accessBlockedAt ? (
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                                                            অ্যাক্সেস বন্ধ
                                                        </span>
                                                    ) : r.unlocked ? (
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                                            রি-রেজিস্টার খোলা
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">স্বাভাবিক</span>
                                                    )}
                                                </td>
                                                <td className="py-2 text-right">
                                                    <button
                                                        onClick={() => toggle(r)}
                                                        disabled={busyRoll === key}
                                                        className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-60 ${
                                                            r.unlocked
                                                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        }`}
                                                    >
                                                        {r.unlocked ? "অনুমতি বাতিল" : "আবার রেজিস্টার করতে দাও"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <p className="text-xs text-gray-400 mt-3">
                                অনুমতি একবারই কাজ করে — ছাত্র নতুন ইমেইলে রেজিস্টার করলেই আবার বন্ধ হয়ে যাবে।
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
