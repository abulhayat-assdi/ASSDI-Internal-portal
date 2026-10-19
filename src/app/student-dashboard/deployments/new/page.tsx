"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    DeployNetworkError,
    deployProject,
    getMyDeployments,
    validateSubdomain,
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

type SubdomainStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

/** Suggests a subdomain from the project name, e.g. "My Portfolio!" → "my-portfolio". */
function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 63);
}

function fallbackSiteBase(): string {
    const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    return domain ? `https://${domain}/site` : "/site";
}

export default function NewDeploymentPage() {
    const router = useRouter();

    const [subdomain, setSubdomain] = useState("");
    const [subdomainTouched, setSubdomainTouched] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [picker, setPicker] = useState<PickerState>({ file: null, status: "none" });
    const [subdomainStatus, setSubdomainStatus] = useState<SubdomainStatus>("idle");
    const [subdomainError, setSubdomainError] = useState("");
    const [deploying, setDeploying] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [submitError, setSubmitError] = useState("");
    const [siteBase, setSiteBase] = useState(fallbackSiteBase);
    const [blockedReason, setBlockedReason] = useState("");
    const [storage, setStorage] = useState<{ used: number; quota: number } | null>(null);

    useEffect(() => {
        getMyDeployments()
            .then((data) => {
                if (data.siteBaseUrl) setSiteBase(data.siteBaseUrl);
                setStorage({ used: data.usedBytes, quota: data.quotaBytes });
                if (data.blockedReason) {
                    setBlockedReason(data.blockedReason);
                } else if (data.deployments.length >= data.deploymentLimit) {
                    setBlockedReason(
                        `আপনার ${data.deploymentLimit}টি সাইটের সবগুলোই ব্যবহার হয়ে গেছে। নতুন সাইট দিতে পুরোনো একটা ডিলিট করুন, অথবা আগের কোনো সাইটে "Update files" দিন।`
                    );
                }
            })
            .catch(() => { /* the form still works; the server re-checks everything */ });
    }, []);

    useEffect(() => {
        if (!subdomain) {
            setSubdomainStatus("idle");
            setSubdomainError("");
            return;
        }
        // Format problems are known locally — no need to wait for the server.
        const problem = subdomainProblem(subdomain);
        if (problem) {
            setSubdomainStatus("invalid");
            setSubdomainError(problem);
            return;
        }
        setSubdomainStatus("checking");
        setSubdomainError("");
        let cancelled = false;
        const timer = setTimeout(async () => {
            const result = await validateSubdomain(subdomain);
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
    }, [subdomain]);

    const handleSubdomainChange = (val: string) => {
        setSubdomainTouched(true);
        setSubdomain(val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    };

    const handleDisplayNameChange = (val: string) => {
        setDisplayName(val);
        if (!subdomainTouched) setSubdomain(slugify(val));
    };

    const handlePickerChange = useCallback((state: PickerState) => {
        setPicker(state);
        setSubmitError("");
    }, []);

    const onDeployed = (liveUrl: string, toastId: string, skipped?: string[]) => {
        toast.success("🚀 ডিপ্লয় হয়েছে! আপনার সাইট এখন লাইভ।", { id: toastId, duration: 5000 });
        if (skipped?.length) toast(`ℹ️ ${skipped.length}টি SVG/XML ফাইল বাদ দেওয়া হয়েছে।`, { duration: 6000 });
        window.open(liveUrl, "_blank", "noopener,noreferrer");
        router.push("/student-dashboard/deployments");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (blockedReason) { setSubmitError(blockedReason); return; }
        if (!picker.file || picker.status === "none") { setSubmitError("একটি .html/.zip ফাইল বা প্রজেক্ট ফোল্ডার দিন।"); return; }
        if (picker.status === "checking") { setSubmitError("একটু অপেক্ষা করুন — ফাইল চেক করা হচ্ছে।"); return; }
        if (picker.status === "error") { setSubmitError("ফাইলে সমস্যা আছে — উপরের লাল লেখাটি দেখে ঠিক করুন।"); return; }
        if (subdomainStatus !== "available") {
            setSubmitError(subdomainError || (subdomainStatus === "checking" ? "একটু অপেক্ষা করুন — সাবডোমেইন চেক করা হচ্ছে।" : "একটি সঠিক সাবডোমেইন দিন।"));
            return;
        }

        setSubmitError("");
        setDeploying(true);
        setUploadProgress(0);
        const toastId = toast.loading("আপলোড হচ্ছে...");
        const fd = new FormData();
        fd.append("file", picker.file);
        fd.append("subdomain", subdomain);
        fd.append("displayName", displayName || subdomain);

        try {
            const { deployment, skippedFiles } = await deployProject(fd, (f) => {
                setUploadProgress(f);
                if (f >= 1) toast.loading("আপলোড শেষ — সাইট সেটআপ হচ্ছে...", { id: toastId });
            });
            onDeployed(deployment.liveUrl, toastId, skippedFiles);
        } catch (err) {
            const message = err instanceof Error ? err.message : "ডিপ্লয় হয়নি।";
            // The response was lost, but the server may have finished anyway —
            // check before telling the student it failed (otherwise a retry
            // would silently use up another slot).
            if (err instanceof DeployNetworkError) {
                try {
                    const data = await getMyDeployments();
                    const created = data.deployments.find((d) => d.subdomain === subdomain);
                    if (created) { onDeployed(created.liveUrl, toastId); return; }
                } catch { /* keep the original message */ }
            }
            toast.error(message, { id: toastId, duration: 6000 });
            setSubmitError(message);
            setDeploying(false);
        }
    };

    const subdomainIndicator = () => {
        if (subdomainStatus === "checking") return <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin inline-block" />;
        if (subdomainStatus === "available") return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
        if (subdomainStatus === "taken" || subdomainStatus === "invalid" || subdomainStatus === "error") return <XCircleIcon className="w-5 h-5 text-red-500" />;
        return null;
    };

    const subdomainBad = subdomainStatus === "taken" || subdomainStatus === "invalid" || subdomainStatus === "error";
    const previewUrl = buildSiteUrl(siteBase, subdomain || "your-subdomain");
    const canSubmit = !deploying && !blockedReason && picker.status === "ok" && subdomainStatus === "available";
    const progressPct = Math.round(uploadProgress * 100);

    return (
        <div className="max-w-xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">নতুন সাইট ডিপ্লয়</h1>
                    <p className="text-sm text-slate-500">HTML ফাইল, ZIP অথবা পুরো প্রজেক্ট ফোল্ডার আপলোড করুন</p>
                </div>
            </div>

            {blockedReason && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    {blockedReason}{" "}
                    <Link href="/student-dashboard/deployments" className="font-semibold underline">My Deployments-এ যান</Link>
                </div>
            )}

            <DeployGuide />

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5 sm:space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        প্রজেক্টের নাম <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
                    </label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => handleDisplayNameChange(e.target.value)}
                        placeholder="যেমন: My Portfolio"
                        maxLength={60}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        সাবডোমেইন <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={subdomain}
                            onChange={(e) => handleSubdomainChange(e.target.value)}
                            placeholder="myproject"
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
                        🌐 আপনার সাইটের লিংক হবে:{" "}
                        <span className={subdomainStatus === "available" ? "text-green-700" : ""}>{previewUrl}</span>
                    </p>
                    {subdomainBad && subdomainError && (
                        <p className="mt-1 text-xs text-red-600">{subdomainError}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা আর হাইফেন (-)। কমপক্ষে ৩ অক্ষর।</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        ফাইল <span className="text-red-500">*</span>
                    </label>
                    <DeployFilePicker disabled={deploying || !!blockedReason} onChange={handlePickerChange} />
                    {storage && (
                        <p className="mt-2 text-xs text-slate-400">
                            জায়গা ব্যবহার: {formatBytes(storage.used)} / {formatBytes(storage.quota)}
                        </p>
                    )}
                </div>

                {submitError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                        <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                    </div>
                )}

                {deploying && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>{progressPct < 100 ? "আপলোড হচ্ছে..." : "সাইট সেটআপ হচ্ছে..."}</span>
                            <span>{progressPct}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {deploying ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ডিপ্লয় হচ্ছে...
                        </>
                    ) : (
                        <>🚀 Deploy Site</>
                    )}
                </button>
            </form>
        </div>
    );
}
