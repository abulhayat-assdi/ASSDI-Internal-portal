"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { getAllDeployments, adminDeleteDeployment, DeploymentWithUser } from "@/services/deploymentService";
import { useAuth } from "@/contexts/AuthContext";
import { formatBytes } from "@/lib/deploymentRules";

const RocketIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

const MagnifyingGlassIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
);

function DeleteModal({
    name,
    onConfirm,
    onCancel,
    loading,
}: {
    name: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h3 className="font-semibold text-slate-800 mb-2">Delete Deployment</h3>
                <p className="text-sm text-slate-600 mb-6">
                    Permanently delete <span className="font-semibold">{name}</span>? This will remove all files and cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                    <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">{icon}</div>
            <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-800">{typeof value === "number" ? value.toLocaleString() : value}</p>
            </div>
        </div>
    );
}

export default function AdminDeploymentsPage() {
    const { userProfile } = useAuth();
    const [deployments, setDeployments] = useState<DeploymentWithUser[]>([]);
    const [stats, setStats] = useState({ total: 0, totalVisitors: 0, totalBytes: 0, flagged: 0 });
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<DeploymentWithUser | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const data = await getAllDeployments();
            setDeployments(data.deployments);
            setStats(data.stats);
        } catch {
            toast.error("Failed to load deployments.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await adminDeleteDeployment(deleteTarget.id);
            toast.success("Deployment deleted.");
            setDeleteTarget(null);
            fetchData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed.");
        } finally {
            setDeleting(false);
        }
    };

    const filtered = deployments.filter((d) => {
        const q = search.toLowerCase();
        return (
            d.subdomain.toLowerCase().includes(q) ||
            d.user.displayName.toLowerCase().includes(q) ||
            (d.user.studentRoll ?? "").toLowerCase().includes(q) ||
            (d.user.studentBatchName ?? "").toLowerCase().includes(q)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <RocketIcon className="w-7 h-7 text-blue-600" />
                    Student Deployments
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">Manage all student-hosted sites and access controls</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Deployments" value={stats.total} icon={<RocketIcon className="w-6 h-6 text-blue-600" />} />
                <StatCard label="Total Visitors" value={stats.totalVisitors} icon={<EyeIcon className="w-6 h-6 text-blue-600" />} />
                <StatCard label="Disk Used" value={formatBytes(stats.totalBytes)} icon={<RocketIcon className="w-6 h-6 text-blue-600" />} />
                <StatCard label="Needs Review" value={stats.flagged} icon={<span className="text-xl">⚠️</span>} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative max-w-xs">
                        <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by name, roll, batch, subdomain..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <RocketIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">No deployments found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subdomain</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Live URL</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Visitors</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map((d) => (
                                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-800">{d.user.displayName}</p>
                                            <p className="text-xs text-slate-400">{d.user.studentBatchName} · Roll {d.user.studentRoll}</p>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                            {d.subdomain}
                                            <p className="text-slate-400">{formatBytes(d.sizeBytes)}</p>
                                            {d.riskFlags?.length > 0 && (
                                                <p className="text-red-600 font-sans" title={d.riskFlags.join(", ")}>⚠️ {d.riskFlags.join(", ")}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <a href={d.liveUrl} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs">
                                                <LinkIcon className="w-3.5 h-3.5" />
                                                Visit
                                            </a>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 text-slate-600">
                                                <EyeIcon className="w-4 h-4" />
                                                {d.totalVisitors.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {d.batchCompleted && !d.user.deployAfterBatchEnd && (
                                                <span className="mr-1 inline-flex items-center text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">Batch completed</span>
                                            )}
                                            {d.user.isDeploymentFrozen ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">🔒 Frozen</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Live
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/dashboard/admin/deployments/student/${d.user.id}`}
                                                    className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                                                >
                                                    Manage
                                                </Link>
                                                <button
                                                    onClick={() => setDeleteTarget(d)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {deleteTarget && (
                <DeleteModal
                    name={`${deleteTarget.displayName} (${deleteTarget.subdomain})`}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleting}
                />
            )}
        </div>
    );
}
