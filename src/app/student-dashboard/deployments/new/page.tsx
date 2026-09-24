"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { deployProject, validateSubdomain } from "@/services/deploymentService";

const UploadCloudIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
);

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

type SubdomainStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function NewDeploymentPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [subdomain, setSubdomain] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [subdomainStatus, setSubdomainStatus] = useState<SubdomainStatus>("idle");
    const [subdomainError, setSubdomainError] = useState("");
    const [deploying, setDeploying] = useState(false);
    const [baseDomain, setBaseDomain] = useState("");

    useEffect(() => {
        const d = process.env.NEXT_PUBLIC_BASE_DOMAIN;
        if (d) setBaseDomain(d);
    }, []);

    useEffect(() => {
        if (!subdomain || subdomain.length < 3) {
            setSubdomainStatus("idle");
            setSubdomainError("");
            return;
        }
        setSubdomainStatus("checking");
        const timer = setTimeout(async () => {
            const result = await validateSubdomain(subdomain);
            if (result.available) {
                setSubdomainStatus("available");
                setSubdomainError("");
            } else {
                setSubdomainStatus(result.error?.includes("taken") ? "taken" : "invalid");
                setSubdomainError(result.error ?? "Invalid subdomain");
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [subdomain]);

    const handleSubdomainChange = (val: string) => {
        const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
        setSubdomain(cleaned);
    };

    const handleFileSelect = (selected: File | null) => {
        if (!selected) return;
        const isHtml = selected.name.endsWith(".html") || selected.type === "text/html";
        const isZip = selected.name.endsWith(".zip") || selected.type === "application/zip";
        if (!isHtml && !isZip) {
            toast.error("Only .html or .zip files are accepted.");
            return;
        }
        if (selected.size > 50 * 1024 * 1024) {
            toast.error("File must be under 50MB.");
            return;
        }
        setFile(selected);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFileSelect(e.dataTransfer.files[0] ?? null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) { toast.error("Please select a file."); return; }
        if (!subdomain) { toast.error("Please enter a subdomain."); return; }
        if (subdomainStatus !== "available") { toast.error("Please wait for subdomain validation."); return; }

        setDeploying(true);
        const toastId = toast.loading("Deploying your site...");
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("subdomain", subdomain);
            fd.append("displayName", displayName || subdomain);
            const { liveUrl } = await deployProject(fd);
            toast.success(`🚀 Deployed! Your site is live.`, { id: toastId, duration: 5000 });
            setTimeout(() => {
                router.push("/student-dashboard/deployments");
            }, 1500);
            window.open(liveUrl, "_blank", "noopener,noreferrer");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Deployment failed.", { id: toastId });
            setDeploying(false);
        }
    };

    const subdomainIndicator = () => {
        if (subdomainStatus === "checking") return <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin inline-block" />;
        if (subdomainStatus === "available") return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
        if (subdomainStatus === "taken" || subdomainStatus === "invalid") return <XCircleIcon className="w-5 h-5 text-red-500" />;
        return null;
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Deploy New Site</h1>
                    <p className="text-sm text-slate-500">Upload an HTML file or ZIP archive</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Project Name <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. My Portfolio"
                        maxLength={60}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Subdomain <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={subdomain}
                            onChange={(e) => handleSubdomainChange(e.target.value)}
                            placeholder="myproject"
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
                            🌐 {subdomainStatus === "available" ? (
                                <span className="text-green-700">https://{subdomain}.{baseDomain}</span>
                            ) : (
                                <span>https://{subdomain}.{baseDomain}</span>
                            )}
                        </p>
                    )}
                    {(subdomainStatus === "taken" || subdomainStatus === "invalid") && subdomainError && (
                        <p className="mt-1 text-xs text-red-600">{subdomainError}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">Lowercase letters, numbers, and hyphens only. Min 3 characters.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        File <span className="text-red-500">*</span>
                    </label>
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                            ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}
                            ${file ? "border-green-400 bg-green-50" : ""}`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".html,.zip"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-2">
                                <CheckCircleIcon className="w-8 h-8 text-green-500" />
                                <p className="font-medium text-slate-700 text-sm">{file.name}</p>
                                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="text-xs text-red-500 hover:underline"
                                >
                                    Remove file
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <UploadCloudIcon className="w-10 h-10 text-slate-300" />
                                <p className="text-sm font-medium text-slate-600">
                                    {dragOver ? "Drop it here!" : "Drag & drop or click to browse"}
                                </p>
                                <p className="text-xs text-slate-400">.html or .zip — max 50MB</p>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={deploying || !file || subdomainStatus !== "available"}
                    className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {deploying ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Deploying...
                        </>
                    ) : (
                        <>🚀 Deploy Site</>
                    )}
                </button>
            </form>
        </div>
    );
}
