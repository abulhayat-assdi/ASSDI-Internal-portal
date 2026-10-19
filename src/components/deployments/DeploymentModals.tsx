"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getDeploymentStats, type Deployment, type DeploymentStats } from "@/services/deploymentService";

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800 truncate">{title}</h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="বন্ধ করুন">✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}

export async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success("লিংক কপি হয়েছে!");
    } catch {
        toast.error("কপি করা যায়নি — লিংকটি সিলেক্ট করে কপি করুন।");
    }
}

/** Link + QR code, for sharing a site on a phone or in a presentation. */
export function ShareModal({ deployment, onClose }: { deployment: Deployment; onClose: () => void }) {
    const [qr, setQr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const mod = await import("qrcode");
                const toDataURL = mod.toDataURL ?? mod.default.toDataURL;
                const url = await toDataURL(deployment.liveUrl, { width: 240, margin: 1, errorCorrectionLevel: "M" });
                if (!cancelled) setQr(url);
            } catch {
                if (!cancelled) setQr("");
            }
        })();
        return () => { cancelled = true; };
    }, [deployment.liveUrl]);

    return (
        <ModalShell title={`শেয়ার করুন — ${deployment.displayName}`} onClose={onClose}>
            <div className="flex flex-col items-center gap-4">
                {qr === null && <div className="w-[240px] h-[240px] bg-slate-100 rounded-xl animate-pulse" />}
                {qr && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr} alt="QR code" width={240} height={240} className="rounded-xl border border-slate-100" />
                )}
                {qr === "" && <p className="text-sm text-slate-500">QR কোড তৈরি করা যায়নি।</p>}
                <p className="text-xs text-slate-500 text-center">মোবাইলের ক্যামেরা দিয়ে স্ক্যান করলেই সাইট খুলবে।</p>
                <div className="w-full flex gap-2">
                    <input readOnly value={deployment.liveUrl} onFocus={(e) => e.target.select()}
                        className="flex-1 min-w-0 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50" />
                    <button onClick={() => copyText(deployment.liveUrl)}
                        className="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">কপি</button>
                </div>
                {qr && (
                    <a href={qr} download={`${deployment.subdomain}-qr.png`} className="text-xs text-blue-600 hover:underline">
                        ⬇️ QR কোড ডাউনলোড
                    </a>
                )}
            </div>
        </ModalShell>
    );
}

/** Unique visitors per day over the last 30 days. */
export function StatsModal({ deployment, onClose }: { deployment: Deployment; onClose: () => void }) {
    const [stats, setStats] = useState<DeploymentStats | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        getDeploymentStats(deployment.id)
            .then(setStats)
            .catch((err) => setError(err instanceof Error ? err.message : "লোড করা যায়নি।"));
    }, [deployment.id]);

    const last30 = stats?.days.reduce((sum, d) => sum + d.visitors, 0) ?? 0;
    const chartData = stats?.days.map((d) => ({ day: d.date.slice(5), visitors: d.visitors })) ?? [];

    return (
        <ModalShell title={`ভিজিটর — ${deployment.displayName}`} onClose={onClose}>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!stats && !error && <div className="h-56 bg-slate-100 rounded-xl animate-pulse" />}
            {stats && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs text-slate-500">মোট ভিজিটর</p>
                            <p className="text-xl font-bold text-slate-800">{stats.totalVisitors.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs text-slate-500">গত ৩০ দিনে</p>
                            <p className="text-xl font-bold text-slate-800">{last30.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                <RechartsTooltip formatter={(v) => [v, "ভিজিটর"]} />
                                <Bar dataKey="visitors" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-slate-400">একই ব্যক্তি দিনে একাধিকবার এলেও একবার গোনা হয়। বট/লিংক-প্রিভিউ গোনা হয় না।</p>
                </div>
            )}
        </ModalShell>
    );
}
