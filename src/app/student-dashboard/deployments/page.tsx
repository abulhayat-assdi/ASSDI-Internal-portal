"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    getMyDeployments,
    deleteDeployment,
    Deployment,
} from "@/services/deploymentService";
import { formatBytes } from "@/lib/deploymentRules";
import { ShareModal, StatsModal, copyText } from "@/components/deployments/DeploymentModals";
import DeployGuide from "@/components/deployments/DeployGuide";

const RocketIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

const PencilIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

const LockClosedIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "এইমাত্র";
    if (mins < 60) return `${mins} মিনিট আগে`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
    const days = Math.floor(hrs / 24);
    return `${days} দিন আগে`;
}

function DeleteModal({
    deployment,
    onConfirm,
    onCancel,
    loading,
}: {
    deployment: Deployment;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <TrashIcon className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800">সাইট ডিলিট করবেন?</h3>
                        <p className="text-sm text-slate-500">এটা আর ফেরত আনা যাবে না।</p>
                    </div>
                </div>
                <p className="text-sm text-slate-600 mb-2">
                    <span className="font-semibold text-slate-800">{deployment.displayName}</span> স্থায়ীভাবে ডিলিট হবে, আর{" "}
                    <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded break-all">{deployment.liveUrl}</span> লিংকটি সাথে সাথে বন্ধ হয়ে যাবে।
                </p>
                <p className="text-xs text-slate-500 mb-6">শুধু কিছু বদলাতে চাইলে ডিলিট না করে ✏️ থেকে &quot;Update files&quot; দিন — লিংক আর ভিজিটর সংখ্যা থেকে যাবে।</p>
                <div className="flex gap-3 justify-end [&>button]:flex-1 sm:[&>button]:flex-none [&>button]:justify-center [&>button]:min-h-11">
                    <button onClick={onCancel} disabled={loading}
                        className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                        বাতিল
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        ডিলিট করুন
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeploymentCard({
    deployment,
    canChange,
    canDelete,
    onDelete,
    onShare,
    onStats,
}: {
    deployment: Deployment;
    canChange: boolean;
    canDelete: boolean;
    onDelete: (d: Deployment) => void;
    onShare: (d: Deployment) => void;
    onStats: (d: Deployment) => void;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Live
                        </span>
                        <span className="text-xs text-slate-400">{formatBytes(deployment.sizeBytes)}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800 truncate">{deployment.displayName}</h3>
                    <button onClick={() => copyText(deployment.liveUrl)} title="লিংক কপি করুন"
                        className="block max-w-full text-left text-xs text-slate-400 hover:text-blue-600 font-mono truncate">
                        {deployment.liveUrl.replace(/^https?:\/\//, "")} 📋
                    </button>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {canChange && (
                        <Link
                            href={`/student-dashboard/deployments/${deployment.id}/edit`}
                            className="p-3 sm:p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Update files / নাম বদলান"
                        >
                            <PencilIcon className="w-4 h-4" />
                        </Link>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => onDelete(deployment)}
                            className="p-3 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ডিলিট"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => onStats(deployment)} className="flex items-center gap-1 text-slate-500 hover:text-blue-600" title="ভিজিটর চার্ট">
                    <EyeIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">{deployment.totalVisitors.toLocaleString()}</span>
                    <span className="text-xs text-slate-400">ভিজিটর 📊</span>
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 hidden sm:inline">{timeAgo(deployment.updatedAt)}</span>
                    <button onClick={() => onShare(deployment)}
                        className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                        QR / শেয়ার
                    </button>
                    <a
                        href={deployment.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <LinkIcon className="w-3.5 h-3.5" />
                        দেখুন
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function StudentDeploymentsPage() {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [limit, setLimit] = useState(5);
    const [isFrozen, setIsFrozen] = useState(false);
    const [blockedReason, setBlockedReason] = useState<string | null>(null);
    const [storage, setStorage] = useState({ used: 0, quota: 0 });
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<Deployment | null>(null);
    const [shareTarget, setShareTarget] = useState<Deployment | null>(null);
    const [statsTarget, setStatsTarget] = useState<Deployment | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const data = await getMyDeployments();
            setDeployments(data.deployments);
            setLimit(data.deploymentLimit);
            setIsFrozen(data.isDeploymentFrozen);
            setBlockedReason(data.blockedReason);
            setStorage({ used: data.usedBytes, quota: data.quotaBytes });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "ডিপ্লয়মেন্টগুলো লোড করা যায়নি।");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteDeployment(deleteTarget.id);
            toast.success("সাইট ডিলিট হয়েছে।");
            setDeleteTarget(null);
            fetchData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "ডিলিট করা যায়নি।");
        } finally {
            setDeleting(false);
        }
    };

    const usedSlots = deployments.length;
    const limitPct = limit > 0 ? Math.min((usedSlots / limit) * 100, 100) : 100;
    const storagePct = storage.quota > 0 ? Math.min((storage.used / storage.quota) * 100, 100) : 0;
    const canDeployNew = !blockedReason && usedSlots < limit;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <RocketIcon className="w-7 h-7 text-blue-600" />
                        My Deployments
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">আপনার HTML প্রজেক্ট লাইভ লিংকে হোস্ট করুন</p>
                </div>
                {canDeployNew && (
                    <Link
                        href="/student-dashboard/deployments/new"
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
                    >
                        <PlusIcon className="w-4 h-4" />
                        নতুন সাইট ডিপ্লয়
                    </Link>
                )}
            </div>

            {blockedReason && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4">
                    <LockClosedIcon className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
                    <div>
                        <p className="font-semibold text-sm">{isFrozen ? "ডিপ্লয়মেন্ট অ্যাক্সেস বন্ধ" : "নতুন ডিপ্লয় বন্ধ"}</p>
                        <p className="text-sm mt-0.5">{blockedReason}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-600">সাইট স্লট</span>
                        <span className="text-sm font-bold text-slate-800">{usedSlots} / {limit}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${limitPct >= 100 ? "bg-red-500" : limitPct >= 80 ? "bg-amber-500" : "bg-blue-600"}`}
                            style={{ width: `${limitPct}%` }}
                        />
                    </div>
                    {usedSlots >= limit && !blockedReason && (
                        <p className="text-xs text-red-600 mt-2">সব স্লট ব্যবহার হয়ে গেছে। নতুন সাইটের জন্য পুরোনো একটা ডিলিট করুন, অথবা আগের সাইটে &quot;Update files&quot; দিন।</p>
                    )}
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-600">জায়গা ব্যবহার</span>
                        <span className="text-sm font-bold text-slate-800">{formatBytes(storage.used)} / {formatBytes(storage.quota)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${storagePct >= 100 ? "bg-red-500" : storagePct >= 80 ? "bg-amber-500" : "bg-blue-600"}`}
                            style={{ width: `${storagePct}%` }}
                        />
                    </div>
                </div>
            </div>

            {deployments.length === 0 ? (
                <div className="space-y-4">
                    <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-300">
                        <RocketIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="font-semibold text-slate-500">এখনো কোনো সাইট নেই</h3>
                        <p className="text-sm text-slate-400 mt-1 mb-4">একটা HTML ফাইল, ZIP বা প্রজেক্ট ফোল্ডার দিয়ে প্রথম সাইটটি লাইভ করুন।</p>
                        {canDeployNew && (
                            <Link
                                href="/student-dashboard/deployments/new"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" />
                                প্রথম সাইট ডিপ্লয় করুন
                            </Link>
                        )}
                    </div>
                    <DeployGuide defaultOpen />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {deployments.map((d) => (
                        <DeploymentCard
                            key={d.id}
                            deployment={d}
                            canChange={!blockedReason}
                            canDelete={!isFrozen}
                            onDelete={setDeleteTarget}
                            onShare={setShareTarget}
                            onStats={setStatsTarget}
                        />
                    ))}
                </div>
            )}

            {deleteTarget && (
                <DeleteModal
                    deployment={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleting}
                />
            )}
            {shareTarget && <ShareModal deployment={shareTarget} onClose={() => setShareTarget(null)} />}
            {statsTarget && <StatsModal deployment={statsTarget} onClose={() => setStatsTarget(null)} />}
        </div>
    );
}
