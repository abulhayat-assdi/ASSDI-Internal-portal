"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import {
    getMyDeployments,
    updateDeployment,
    validateSubdomain,
    Deployment,
} from "@/services/deploymentService";

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

type SubdomainStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "same";

export default function EditDeploymentPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();

    const [deployment, setDeployment] = useState<Deployment | null>(null);
    const [loading, setLoading] = useState(true);
    const [subdomain, setSubdomain] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [subdomainStatus, setSubdomainStatus] = useState<SubdomainStatus>("same");
    const [subdomainError, setSubdomainError] = useState("");
    const [saving, setSaving] = useState(false);
    const [baseDomain] = useState(process.env.NEXT_PUBLIC_BASE_DOMAIN || "");

    useEffect(() => {
        (async () => {
            try {
                const data = await getMyDeployments();
                const found = data.deployments.find((d) => d.id === id);
                if (!found) { toast.error("Deployment not found."); router.push("/student-dashboard/deployments"); return; }
                setDeployment(found);
                setSubdomain(found.subdomain);
                setDisplayName(found.displayName);
            } catch {
                toast.error("Failed to load deployment.");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, router]);

    useEffect(() => {
        if (!subdomain || subdomain.length < 3) { setSubdomainStatus("idle"); setSubdomainError(""); return; }
        if (deployment && subdomain === deployment.subdomain) { setSubdomainStatus("same"); setSubdomainError(""); return; }
        setSubdomainStatus("checking");
        const timer = setTimeout(async () => {
            const result = await validateSubdomain(subdomain, id);
            if (result.available) {
                setSubdomainStatus("available");
                setSubdomainError("");
            } else {
                setSubdomainStatus(result.error?.includes("taken") ? "taken" : "invalid");
                setSubdomainError(result.error ?? "Invalid subdomain");
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [subdomain, deployment, id]);

    const handleSubdomainChange = (val: string) => {
        const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
        setSubdomain(cleaned);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deployment) return;

        const subdomainChanged = subdomain !== deployment.subdomain;
        if (subdomainChanged && subdomainStatus !== "available") {
            toast.error("Please wait for subdomain validation.");
            return;
        }

        setSaving(true);
        try {
            await updateDeployment(id, { subdomain, displayName });
            toast.success(subdomainChanged ? "Subdomain updated! Old URL is now inactive." : "Changes saved.");
            router.push("/student-dashboard/deployments");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed.");
        } finally {
            setSaving(false);
        }
    };

    const subdomainIndicator = () => {
        if (subdomainStatus === "same") return <CheckCircleIcon className="w-5 h-5 text-slate-300" />;
        if (subdomainStatus === "checking") return <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin inline-block" />;
        if (subdomainStatus === "available") return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
        if (subdomainStatus === "taken" || subdomainStatus === "invalid") return <XCircleIcon className="w-5 h-5 text-red-500" />;
        return null;
    };

    const canSave = subdomainStatus === "same" || subdomainStatus === "available";

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
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Edit Deployment</h1>
                    <p className="text-sm text-slate-500">Update project name or subdomain</p>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <strong>Note:</strong> Changing the subdomain will immediately deactivate the old URL. No redirect is created. Make sure to update any shared links.
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Project Name</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={60}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Subdomain</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={subdomain}
                            onChange={(e) => handleSubdomainChange(e.target.value)}
                            minLength={3}
                            maxLength={63}
                            required
                            className={`w-full px-3.5 py-2.5 pr-10 text-sm border rounded-xl focus:outline-none focus:ring-2 transition font-mono
                                ${subdomainStatus === "available" ? "border-green-400 focus:ring-green-400" :
                                  subdomainStatus === "taken" || subdomainStatus === "invalid" ? "border-red-400 focus:ring-red-400" :
                                  "border-slate-200 focus:ring-blue-500 focus:border-transparent"}`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {subdomainIndicator()}
                        </div>
                    </div>
                    {subdomain.length >= 3 && (
                        <p className="mt-1.5 text-xs text-slate-500 font-mono">
                            🌐 https://{subdomain}.{baseDomain}
                        </p>
                    )}
                    {(subdomainStatus === "taken" || subdomainStatus === "invalid") && subdomainError && (
                        <p className="mt-1 text-xs text-red-600">{subdomainError}</p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button type="button" onClick={() => router.back()}
                        className="flex-1 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !canSave}
                        className="flex-1 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
