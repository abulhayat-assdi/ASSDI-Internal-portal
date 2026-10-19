"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatBytes } from "@/lib/deploymentRules";
import {
    getStudentDeploymentData,
    updateStudentDeploymentSettings,
    adminDeleteDeployment,
    Deployment,
} from "@/services/deploymentService";

const ArrowLeftIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
);

interface StudentInfo {
    id: string;
    displayName: string;
    studentBatchName: string | null;
    studentRoll: string | null;
    deploymentLimit: number;
    isDeploymentFrozen: boolean;
    deployAfterBatchEnd: boolean;
}

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
                    Permanently delete <span className="font-semibold">{name}</span>? This removes the live site and all data.
                </p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                    <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center gap-2">
                        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminStudentDeploymentPage() {
    const { userId } = useParams<{ userId: string }>();
    const router = useRouter();

    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);

    const [limitInput, setLimitInput] = useState("");
    const [isFrozen, setIsFrozen] = useState(false);
    const [afterBatchEnd, setAfterBatchEnd] = useState(false);
    const [batchCompleted, setBatchCompleted] = useState(false);
    const [usage, setUsage] = useState({ used: 0, quota: 0 });
    const [savingSettings, setSavingSettings] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<Deployment | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const data = await getStudentDeploymentData(userId);
            setStudent(data.user as StudentInfo);
            setDeployments(data.deployments);
            setLimitInput(String(data.user.deploymentLimit));
            setIsFrozen(data.user.isDeploymentFrozen);
            setAfterBatchEnd(data.user.deployAfterBatchEnd);
            setBatchCompleted(data.batchCompleted);
            setUsage({ used: data.usedBytes, quota: data.quotaBytes });
        } catch {
            toast.error("Failed to load student data.");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveSettings = async () => {
        const limit = parseInt(limitInput);
        if (isNaN(limit) || limit < 0 || limit > 100) {
            toast.error("Limit must be between 0 and 100.");
            return;
        }
        setSavingSettings(true);
        try {
            await updateStudentDeploymentSettings(userId, {
                deploymentLimit: limit,
                isDeploymentFrozen: isFrozen,
                deployAfterBatchEnd: afterBatchEnd,
            });
            toast.success("Settings updated.");
            fetchData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Update failed.");
        } finally {
            setSavingSettings(false);
        }
    };

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

    const settingsChanged = student
        ? limitInput !== String(student.deploymentLimit) || isFrozen !== student.isDeploymentFrozen || afterBatchEnd !== student.deployAfterBatchEnd
        : false;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!student) return null;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/admin/deployments" className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">{student.displayName}</h1>
                    <p className="text-sm text-slate-500">
                        {student.studentBatchName} · Roll {student.studentRoll} · {deployments.length} / {student.deploymentLimit} slots · {formatBytes(usage.used)} / {formatBytes(usage.quota)}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Access Settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Deployment Limit
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={limitInput}
                            onChange={(e) => setLimitInput(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                        <p className="text-xs text-slate-400 mt-1">Default: 5. Set to 0 to block all new deployments.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Deployment Access
                        </label>
                        <button
                            type="button"
                            onClick={() => setIsFrozen(!isFrozen)}
                            className={`relative inline-flex h-10 w-full items-center rounded-xl border px-4 text-sm font-medium transition-all ${
                                isFrozen
                                    ? "bg-amber-50 border-amber-300 text-amber-700"
                                    : "bg-green-50 border-green-300 text-green-700"
                            }`}
                        >
                            <span className={`w-3 h-3 rounded-full mr-2 ${isFrozen ? "bg-amber-500" : "bg-green-500"}`} />
                            {isFrozen ? "🔒 Frozen — Student cannot deploy" : "✅ Active — Student can deploy"}
                        </button>
                        <p className="text-xs text-slate-400 mt-1">Freezing keeps existing sites live but blocks new actions.</p>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            After Batch Completion
                            {batchCompleted && <span className="ml-2 text-xs font-normal text-amber-700">(this batch is completed)</span>}
                        </label>
                        <button
                            type="button"
                            onClick={() => setAfterBatchEnd(!afterBatchEnd)}
                            className={`inline-flex h-10 w-full items-center rounded-xl border px-4 text-sm font-medium transition-all ${
                                afterBatchEnd
                                    ? "bg-green-50 border-green-300 text-green-700"
                                    : "bg-slate-50 border-slate-300 text-slate-600"
                            }`}
                        >
                            {afterBatchEnd ? "✅ Allowed — can deploy/update even after the batch is completed" : "⛔ Not allowed — deploying stops when the batch is completed"}
                        </button>
                        <p className="text-xs text-slate-400 mt-1">
                            Completing a batch automatically blocks new deploys and updates for its students (existing sites stay live and can be deleted). Turn this on to make an exception for this student.
                        </p>
                    </div>
                </div>

                {settingsChanged && (
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {savingSettings && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            Save Settings
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-800">
                        Deployments <span className="text-slate-400 font-normal">({deployments.length})</span>
                    </h2>
                </div>

                {deployments.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-slate-400 text-sm">This student has no deployments yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Live URL</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Visitors</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deployed</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {deployments.map((d) => (
                                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-800">{d.displayName}</p>
                                            <p className="text-xs text-slate-400 font-mono">{d.subdomain} · {formatBytes(d.sizeBytes)}</p>
                                            {d.riskFlags?.length > 0 && (
                                                <p className="text-xs text-red-600 mt-0.5" title={d.riskFlags.join(", ")}>⚠️ Review: {d.riskFlags.join(", ")}</p>
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
                                        <td className="px-4 py-3 text-xs text-slate-400">
                                            {new Date(d.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setDeleteTarget(d)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
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
