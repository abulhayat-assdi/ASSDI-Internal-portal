"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import {
    getMyDeployments,
    updateDeployment,
    updateDeploymentFiles,
    validateSubdomain,
    Deployment,
} from "@/services/deploymentService";
import { buildSiteUrl, formatBytes, subdomainProblem } from "@/lib/deploymentRules";
import DeployFilePicker, { type PickerState } from "@/components/deployments/DeployFilePicker";
import DeployGuide from "@/components/deployments/DeployGuide";

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const ArrowLeftIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
);

type SubdomainStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "error" | "same";

export default function EditDeploymentPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();

    const [deployment, setDeployment] = useState<Deployment | null>(null);
    const [loading, setLoading] = useState(true);
    const [blockedReason, setBlockedReason] = useState("");
    const [subdomain, setSubdomain] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [subdomainStatus, setSubdomainStatus] = useState<SubdomainStatus>("same");
    const [subdomainError, setSubdomainError] = useState("");
    const [saving, setSaving] = useState(false);
    const [siteBase, setSiteBase] = useState(() => {
        const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
        return domain ? `https://${domain}/site` : "/site";
    });

    const [picker, setPicker] = useState<PickerState>({ file: null, status: "none" });
    const [pickerKey, setPickerKey] = useState(0);
    const [updating, setUpdating] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [updateError, setUpdateError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const data = await getMyDeployments();
                if (data.siteBaseUrl) setSiteBase(data.siteBaseUrl);
                setBlockedReason(data.blockedReason ?? "");
                const found = data.deployments.find((d) => d.id === id);
                if (!found) { toast.error("সাইটটি পাওয়া যায়নি।"); router.push("/student-dashboard/deployments"); return; }
                setDeployment(found);
                setSubdomain(found.subdomain);
                setDisplayName(found.displayName);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "সাইটটি লোড করা যায়নি।");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, router]);

    useEffect(() => {
        if (deployment && subdomain === deployment.subdomain) { setSubdomainStatus("same"); setSubdomainError(""); return; }
        const problem = subdomainProblem(subdomain);
        if (problem) { setSubdomainStatus("invalid"); setSubdomainError(problem); return; }
        setSubdomainStatus("checking");
        setSubdomainError("");
        let cancelled = false;
        const timer = setTimeout(async () => {
            const result = await validateSubdomain(subdomain, id);
            if (cancelled) return;
            if (result.available) {
                setSubdomainStatus("available");
                setSubdomainError("");
            } else {
                setSubdomainStatus(result.reason === "taken" ? "taken" : result.reason === "error" ? "error" : "invalid");
                setSubdomainError(result.error ?? "সাবডোমেইনটি সঠিক নয়।");
            }
        }, 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [subdomain, deployment, id]);

    const handlePickerChange = useCallback((state: PickerState) => {
        setPicker(state);
        setUpdateError("");
    }, []);

    const handleSubdomainChange = (val: string) => {
        setSubdomain(val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deployment) return;

        const subdomainChanged = subdomain !== deployment.subdomain;
        if (subdomainChanged && subdomainStatus !== "available") {
            toast.error(subdomainError || "একটু অপেক্ষা করুন — সাবডোমেইন চেক করা হচ্ছে।");
            return;
        }

        setSaving(true);
        try {
            await updateDeployment(id, { subdomain, displayName });
            toast.success(subdomainChanged ? "সাবডোমেইন বদলানো হয়েছে! পুরোনো লিংক আর কাজ করবে না।" : "সেভ হয়েছে।");
            router.push("/student-dashboard/deployments");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "সেভ করা যায়নি।");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateFiles = async () => {
        if (!deployment || !picker.file || picker.status !== "ok") return;
        setUpdating(true);
        setUpdateError("");
        setUploadProgress(0);
        const toastId = toast.loading("নতুন ফাইল আপলোড হচ্ছে...");
        try {
            const { deployment: updated, skippedFiles } = await updateDeploymentFiles(deployment.id, picker.file, (f) => {
                setUploadProgress(f);
                if (f >= 1) toast.loading("আপলোড শেষ — সাইট আপডেট হচ্ছে...", { id: toastId });
            });
            toast.success("✅ সাইট আপডেট হয়েছে! লিংক একই আছে।", { id: toastId, duration: 5000 });
            if (skippedFiles?.length) toast(`ℹ️ ${skippedFiles.length}টি SVG/XML ফাইল বাদ দেওয়া হয়েছে।`, { duration: 6000 });
            setDeployment(updated);
            setPickerKey((k) => k + 1);
            window.open(updated.liveUrl, "_blank", "noopener,noreferrer");
        } catch (err) {
            const message = err instanceof Error ? err.message : "আপডেট হয়নি।";
            toast.error(message, { id: toastId, duration: 6000 });
            setUpdateError(message);
        } finally {
            setUpdating(false);
        }
    };

    const subdomainBad = subdomainStatus === "taken" || subdomainStatus === "invalid" || subdomainStatus === "error";
    const subdomainIndicator = () => {
        if (subdomainStatus === "same") return <CheckCircleIcon className="w-5 h-5 text-slate-300" />;
        if (subdomainStatus === "checking") return <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin inline-block" />;
        if (subdomainStatus === "available") return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
        if (subdomainBad) return <XCircleIcon className="w-5 h-5 text-red-500" />;
        return null;
    };

    const canSave = !blockedReason && (subdomainStatus === "same" || subdomainStatus === "available");
    const progressPct = Math.round(uploadProgress * 100);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!deployment) return null;

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                    <h1 className="text-xl font-bold text-slate-800 truncate">{deployment.displayName}</h1>
                    <a href={deployment.liveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-mono break-all hover:underline">
                        {deployment.liveUrl}
                    </a>
                </div>
            </div>

            {blockedReason && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{blockedReason}</div>
            )}

            {/* ── Update files ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
                <div>
                    <h2 className="font-semibold text-slate-800">🔄 Update files</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        সাইটে পরিবর্তন করেছেন? নতুন ফাইল দিন — লিংক আর ভিজিটর সংখ্যা একই থাকবে। এখনকার সাইজ: {formatBytes(deployment.sizeBytes)}
                    </p>
                </div>
                <DeployFilePicker key={pickerKey} disabled={updating || !!blockedReason} onChange={handlePickerChange} />
                {updateError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                        <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{updateError}</span>
                    </div>
                )}
                {updating && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>{progressPct < 100 ? "আপলোড হচ্ছে..." : "সাইট আপডেট হচ্ছে..."}</span>
                            <span>{progressPct}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                        </div>
                    </div>
                )}
                <button
                    type="button"
                    onClick={handleUpdateFiles}
                    disabled={updating || !!blockedReason || picker.status !== "ok"}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {updating ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            আপডেট হচ্ছে...
                        </>
                    ) : "🔄 ফাইল আপডেট করুন"}
                </button>
            </div>

            {/* ── Rename ── */}
            <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5">
                <h2 className="font-semibold text-slate-800">✏️ নাম / সাবডোমেইন বদলান</h2>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">প্রজেক্টের নাম</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={60}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">সাবডোমেইন</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={subdomain}
                            onChange={(e) => handleSubdomainChange(e.target.value)}
                            maxLength={63}
                            required
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            className={`w-full px-3.5 py-2.5 pr-10 text-sm border rounded-xl focus:outline-none focus:ring-2 transition font-mono
                                ${subdomainStatus === "available" ? "border-green-400 focus:ring-green-400" :
                                  subdomainBad ? "border-red-400 focus:ring-red-400" :
                                  "border-slate-200 focus:ring-blue-500 focus:border-transparent"}`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {subdomainIndicator()}
                        </div>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 font-mono break-all">
                        🌐 {buildSiteUrl(siteBase, subdomain || "your-subdomain")}
                    </p>
                    {subdomainBad && subdomainError && (
                        <p className="mt-1 text-xs text-red-600">{subdomainError}</p>
                    )}
                    {subdomain !== deployment.subdomain && (
                        <p className="mt-1 text-xs text-amber-700">⚠️ সাবডোমেইন বদলালে পুরোনো লিংক সাথে সাথে বন্ধ হয়ে যাবে — শেয়ার করা লিংকগুলো আপডেট করে নিন।</p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button type="button" onClick={() => router.back()}
                        className="flex-1 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                        বাতিল
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !canSave}
                        className="flex-1 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                সেভ হচ্ছে...
                            </>
                        ) : "সেভ করুন"}
                    </button>
                </div>
            </form>

            <DeployGuide />
        </div>
    );
}
