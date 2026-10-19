"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    DeployNetworkError,
    deployProject,
    getMyDeployments,
    validateSubdomain,
} from "@/services/deploymentService";
import { MAX_DEPLOY_SIZE_MB, buildSiteUrl, subdomainProblem } from "@/lib/deploymentRules";
import { preflightDeployFile } from "@/lib/deploymentPreflight";

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

type SubdomainStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "error";
type FileStatus = "none" | "checking" | "ok" | "error";

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const latestFileRef = useRef<File | null>(null);

    const [subdomain, setSubdomain] = useState("");
    const [subdomainTouched, setSubdomainTouched] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [fileStatus, setFileStatus] = useState<FileStatus>("none");
    const [fileError, setFileError] = useState("");
    const [fileNote, setFileNote] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [subdomainStatus, setSubdomainStatus] = useState<SubdomainStatus>("idle");
    const [subdomainError, setSubdomainError] = useState("");
    const [deploying, setDeploying] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [submitError, setSubmitError] = useState("");
    const [siteBase, setSiteBase] = useState(fallbackSiteBase);
    const [blockedReason, setBlockedReason] = useState("");

    useEffect(() => {
        getMyDeployments()
            .then((data) => {
                if (data.siteBaseUrl) setSiteBase(data.siteBaseUrl);
                if (data.isDeploymentFrozen) {
                    setBlockedReason("Your deployment access has been frozen by an administrator. Please contact your instructor.");
                } else if (data.deployments.length >= data.deploymentLimit) {
                    setBlockedReason(
                        `You already have ${data.deployments.length} of ${data.deploymentLimit} allowed sites. Delete an old site from My Deployments to deploy a new one.`
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
                setSubdomainError(result.error ?? "Invalid subdomain");
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

    const handleFileSelect = async (selected: File | null) => {
        if (!selected) return;
        setFile(selected);
        setSubmitError("");
        setFileNote("");
        setFileError("");
        setFileStatus("checking");
        latestFileRef.current = selected;
        const result = await preflightDeployFile(selected);
        if (latestFileRef.current !== selected) return; // a newer pick replaced this one
        setFileStatus(result.error ? "error" : "ok");
        setFileError(result.error ?? "");
        setFileNote(result.note ?? "");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const clearFile = () => {
        latestFileRef.current = null;
        setFile(null);
        setFileStatus("none");
        setFileError("");
        setFileNote("");
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        void handleFileSelect(e.dataTransfer.files[0] ?? null);
    };

    const onDeployed = (liveUrl: string, toastId: string) => {
        toast.success("🚀 Deployed! Your site is live.", { id: toastId, duration: 5000 });
        window.open(liveUrl, "_blank", "noopener,noreferrer");
        router.push("/student-dashboard/deployments");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (blockedReason) { setSubmitError(blockedReason); return; }
        if (!file) { setSubmitError("Please select an .html or .zip file."); return; }
        if (fileStatus === "checking") { setSubmitError("Please wait — the file is still being checked."); return; }
        if (fileStatus === "error") { setSubmitError(fileError); return; }
        if (subdomainStatus !== "available") {
            setSubmitError(subdomainError || (subdomainStatus === "checking" ? "Please wait — checking subdomain availability." : "Please enter a valid subdomain."));
            return;
        }

        setSubmitError("");
        setDeploying(true);
        setUploadProgress(0);
        const toastId = toast.loading("Uploading your site...");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("subdomain", subdomain);
        fd.append("displayName", displayName || subdomain);

        try {
            const { liveUrl } = await deployProject(fd, (f) => {
                setUploadProgress(f);
                if (f >= 1) toast.loading("Upload complete — setting up your site...", { id: toastId });
            });
            onDeployed(liveUrl, toastId);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Deployment failed.";
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
    const canSubmit = !deploying && !blockedReason && !!file && fileStatus === "ok" && subdomainStatus === "available";
    const progressPct = Math.round(uploadProgress * 100);

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

            {blockedReason && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    {blockedReason}{" "}
                    <Link href="/student-dashboard/deployments" className="font-semibold underline">Go to My Deployments</Link>
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5 sm:space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Project Name <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => handleDisplayNameChange(e.target.value)}
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
                        🌐 Your site will be live at:{" "}
                        <span className={subdomainStatus === "available" ? "text-green-700" : ""}>{previewUrl}</span>
                    </p>
                    {subdomainBad && subdomainError && (
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
                        onClick={() => !deploying && fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-all
                            ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}
                            ${fileStatus === "ok" ? "border-green-400 bg-green-50" : ""}
                            ${fileStatus === "error" ? "border-red-300 bg-red-50" : ""}`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".html,.htm,.zip,text/html,application/zip,application/x-zip-compressed"
                            className="hidden"
                            onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-2">
                                {fileStatus === "checking" && <span className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />}
                                {fileStatus === "ok" && <CheckCircleIcon className="w-8 h-8 text-green-500" />}
                                {fileStatus === "error" && <XCircleIcon className="w-8 h-8 text-red-500" />}
                                <p className="font-medium text-slate-700 text-sm break-all">{file.name}</p>
                                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                {fileStatus === "checking" && <p className="text-xs text-slate-500">Checking file...</p>}
                                {!deploying && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); clearFile(); }}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        Remove file
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <UploadCloudIcon className="w-10 h-10 text-slate-300" />
                                <p className="text-sm font-medium text-slate-600">
                                    {dragOver ? "Drop it here!" : "Drag & drop or click to browse"}
                                </p>
                                <p className="text-xs text-slate-400">.html or .zip — max {MAX_DEPLOY_SIZE_MB}MB</p>
                            </div>
                        )}
                    </div>
                    {fileStatus === "error" && fileError && (
                        <p className="mt-1.5 text-xs text-red-600">{fileError}</p>
                    )}
                    {fileStatus === "ok" && fileNote && (
                        <p className="mt-1.5 text-xs text-slate-500">{fileNote}</p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-400">
                        For a ZIP: put index.html, CSS, JS and images in one folder and zip that folder.
                    </p>
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
                            <span>{progressPct < 100 ? "Uploading..." : "Setting up your site..."}</span>
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
