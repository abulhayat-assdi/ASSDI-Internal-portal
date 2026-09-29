"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
    getAllUpdateRequests,
    approveUpdateRequest,
    rejectUpdateRequest,
    StudentUpdateRequest,
} from "@/services/studentUpdateService";

const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
        pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
        approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
        rejected: "bg-red-50 text-red-700 border-red-200",
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wide ${styles[status] || styles.pending}`}>
            {status}
        </span>
    );
};

export default function StudentUpdatesPage() {
    const { userProfile } = useAuth();
    const [requests, setRequests] = useState<StudentUpdateRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
    const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

    const fetchRequests = async () => {
        try {
            const data = await getAllUpdateRequests();
            setRequests(data);
        } catch (e) {
            console.error("Failed to load update requests:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleApprove = async (requestId: string) => {
        setActionId(requestId);
        try {
            await approveUpdateRequest(requestId, userProfile?.displayName || "Admin");
            await fetchRequests();
            toast.success("Approved and updated.");
        } catch (e) {
            console.error("Approval failed", e);
            toast.error(e instanceof Error ? e.message : "Approval failed.");
        } finally {
            setActionId(null);
        }
    };

    const handleReject = async (requestId: string) => {
        setActionId(requestId);
        try {
            await rejectUpdateRequest(requestId, userProfile?.displayName || "Admin", rejectNote[requestId] || "");
            await fetchRequests();
            toast.success("Request rejected.");
        } catch (e) {
            console.error("Rejection failed", e);
            toast.error(e instanceof Error ? e.message : "Rejection failed.");
        } finally {
            setActionId(null);
        }
    };

    const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);
    const pendingCount = requests.filter(r => r.status === "pending").length;

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]"></div>
        </div>
    );

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Student Update Requests
                        {pendingCount > 0 && (
                            <span className="px-2.5 py-0.5 bg-red-500 text-white rounded-full text-sm font-bold">
                                {pendingCount}
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Review profile change requests from students. Approving auto-updates their batch record.</p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                    {(["all", "pending", "approved", "rejected"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
                                filter === tab
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center p-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No requests found</h3>
                    <p className="text-gray-500 text-sm mt-1">No {filter !== "all" ? filter : ""} update requests at this time.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map(req => (
                        <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            {/* Request Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-lg">
                                        {req.studentName?.charAt(0).toUpperCase() || "?"}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{req.studentName}</h3>
                                        <p className="text-xs text-gray-500">
                                            Batch {req.studentBatchName} · Roll {req.studentRoll}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {statusBadge(req.status)}
                                    <span className="text-xs text-gray-400">
                                        {req.submittedAt && new Date(req.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                </div>
                            </div>

                            {/* Changes Table */}
                            <div className="p-6">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Proposed Changes</h4>
                                <div className="rounded-xl overflow-hidden border border-gray-100">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="text-left px-4 py-2 font-semibold text-gray-500 w-1/4">Field</th>
                                                <th className="text-left px-4 py-2 font-semibold text-gray-500 w-[37.5%]">Current Value</th>
                                                <th className="text-left px-4 py-2 font-semibold text-gray-500 w-[37.5%]">Proposed Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(req.proposedChanges || {}).map(([field, newValue]) => {
                                                const oldVal = (req.currentData as any)?.[field];
                                                return (
                                                    <tr key={field} className="border-b border-gray-50 last:border-0">
                                                        <td className="px-4 py-2 font-medium text-gray-600 capitalize">
                                                            {field.replace(/([A-Z])/g, ' $1').trim()}
                                                        </td>
                                                        <td className="px-4 py-2 text-red-500 line-through">{oldVal || "—"}</td>
                                                        <td className="px-4 py-2 text-emerald-700 font-semibold">{newValue || "—"}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {req.adminNote && (
                                    <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-100">
                                        <span className="font-bold">Admin Note: </span>{req.adminNote}
                                    </div>
                                )}

                                {req.status === "pending" && (
                                    <div className="mt-5 flex flex-col gap-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleApprove(req.id)}
                                                disabled={actionId === req.id}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors shadow-sm disabled:opacity-60"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                {actionId === req.id ? "Approving..." : "Approve & Update"}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="text"
                                                value={rejectNote[req.id] || ""}
                                                onChange={(e) => setRejectNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                placeholder="Add a note for rejection (optional)"
                                                className="flex-1 text-sm p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-400 bg-gray-50"
                                            />
                                            <button
                                                onClick={() => handleReject(req.id)}
                                                disabled={actionId === req.id}
                                                className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 text-sm font-bold rounded-xl hover:bg-red-100 transition-colors shadow-sm disabled:opacity-60 whitespace-nowrap"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
