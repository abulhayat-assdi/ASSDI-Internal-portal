"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

type LeaveRequest = {
    id: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    reviewNote?: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (y && m && d) {
        return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    return new Date(dateStr).toLocaleDateString();
};

export default function StudentLeavePage() {
    const { userProfile, loading: authLoading } = useAuth();
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [canApply, setCanApply] = useState(true);
    const [batchName, setBatchName] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchLeaves = async () => {
            try {
                const res = await fetch("/api/student/leave");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setRequests(data);
                    } else if (data && data.requests) {
                        setRequests(data.requests);
                        if (data.canApply !== undefined) setCanApply(data.canApply);
                        if (data.batchName) setBatchName(data.batchName);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch leaves", err);
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading && userProfile) {
            fetchLeaves();
        }
    }, [authLoading, userProfile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileError("");
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) {
            setFile(null);
            return;
        }

        if (selectedFile.size > MAX_FILE_SIZE) {
            setFileError("File size exceeds 10MB limit. Please select a smaller file.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            setFile(null);
            return;
        }

        setFile(selectedFile);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!startDate || !endDate || !reason) {
            setError("All required fields must be filled out.");
            return;
        }

        if (file && file.size > MAX_FILE_SIZE) {
            setError("File size exceeds 10MB limit.");
            return;
        }

        setSubmitting(true);
        try {
            let attachmentUrl: string | null = null;
            let attachmentName: string | null = null;

            if (file) {
                const uploadFormData = new FormData();
                uploadFormData.append("file", file);
                uploadFormData.append("folder", "student-leaves");

                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: uploadFormData,
                });

                if (!uploadRes.ok) {
                    const errData = await uploadRes.json();
                    setError(errData.error || "Failed to upload attachment.");
                    setSubmitting(false);
                    return;
                }

                const uploadData = await uploadRes.json();
                attachmentUrl = uploadData.url;
                attachmentName = file.name;
            }

            const res = await fetch("/api/student/leave", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    reason,
                    attachmentUrl,
                    attachmentName,
                }),
            });

            if (res.ok) {
                const newRequest = await res.json();
                setRequests([newRequest, ...requests]);
                setSuccess("Leave request submitted successfully!");
                setStartDate("");
                setEndDate("");
                setReason("");
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            } else {
                const data = await res.json();
                setError(data.error || "Failed to submit leave request");
            }
        } catch (err) {
            setError("An error occurred. Please try again later.");
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="max-w-4xl mx-auto space-y-5 md:space-y-8">
                
                {/* Header Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 md:p-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-1 sm:mb-2">Leave Request</h1>
                    <p className="text-slate-500">Submit a new leave request or view your past requests.</p>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 md:gap-8">
                    
                    {/* Form Section */}
                    <div className="xl:col-span-1">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 xl:sticky xl:top-22">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4 sm:mb-6">New Request</h2>
                            
                            {!canApply ? (
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                                    <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                                        <span>🔒</span> Leave Applications Closed
                                    </div>
                                    <p className="text-xs text-amber-700 leading-relaxed">
                                        Leave applications are closed for completed batches {batchName ? `(${batchName})` : ""}. You can view your previous leave history on the right.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
                                    {success && <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">{success}</div>}
                                    
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full min-w-0 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full min-w-0 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
                                            <textarea
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm"
                                                rows={4}
                                                placeholder="Briefly explain your reason for leave..."
                                                required
                                            ></textarea>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Attachment <span className="text-slate-400 font-normal">(Optional, PDF/Image max 10MB)</span>
                                            </label>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={handleFileChange}
                                                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-lg bg-slate-50 p-1"
                                            />
                                            {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
                                            {file && (
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Selected: <span className="font-medium text-slate-700">{file.name}</span> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                                        >
                                            {submitting ? "Submitting..." : "Submit Request"}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>

                    {/* History Section */}
                    <div className="xl:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4 sm:mb-6">Request History</h2>
                            
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                                </div>
                            ) : requests.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                    <div className="text-4xl mb-3">📝</div>
                                    <h3 className="text-slate-700 font-medium mb-1">No leave requests yet</h3>
                                    <p className="text-slate-500 text-sm">When you submit a leave request, it will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {requests.map((req) => (
                                        <div key={req.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                                            <div className="flex justify-between items-start gap-3 mb-3">
                                                <div className="min-w-0">
                                                    <div className="text-sm text-slate-500 mb-1">
                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                    </div>
                                                    <div className="font-medium text-slate-800">
                                                        {formatDateSafe(req.startDate)} to {formatDateSafe(req.endDate)}
                                                    </div>
                                                </div>
                                                <span className={`shrink-0 px-3 py-1 text-xs font-semibold rounded-full ${
                                                    req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                    req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 text-sm mb-3 bg-white p-3 rounded-lg border border-slate-100 whitespace-pre-wrap break-words">{req.reason}</p>
                                            {req.attachmentUrl && (
                                                <div className="mb-3">
                                                    <a
                                                        href={req.attachmentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-white p-2 rounded-lg border border-slate-200 font-medium transition-colors break-all"
                                                    >
                                                        <span>📎</span>
                                                        <span className="truncate max-w-[60vw] sm:max-w-[250px]">{req.attachmentName || "View Attachment"}</span>
                                                    </a>
                                                </div>
                                            )}
                                            {req.reviewNote && (
                                                <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
                                                    <strong>Admin Note:</strong> {req.reviewNote}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
