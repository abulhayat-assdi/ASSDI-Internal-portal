"use client";

import { useState, useEffect, useMemo } from "react";

type LeaveRequest = {
    id: string;
    studentName: string;
    studentRoll: string;
    studentPhone?: string | null;
    studentBatchName: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    reviewNote?: string;
};

const MagnifyingGlassIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
);

const ArrowDownTrayIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

export default function AdminStudentLeavesPage() {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [notes, setNotes] = useState<{ [id: string]: string }>({});

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBatch, setSelectedBatch] = useState("ALL");

    // Download Modal states
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportTargetType, setExportTargetType] = useState<"batch" | "student">("batch");
    const [exportBatch, setExportBatch] = useState("ALL");
    const [exportStudentRoll, setExportStudentRoll] = useState("");

    // Add Leave Modal states
    const [isAddLeaveModalOpen, setIsAddLeaveModalOpen] = useState(false);
    const [allBatchStudents, setAllBatchStudents] = useState<any[]>([]);
    const [fetchingStudents, setFetchingStudents] = useState(false);

    const [addBatchName, setAddBatchName] = useState("");
    const [addStudentRoll, setAddStudentRoll] = useState("");
    const [addStartDate, setAddStartDate] = useState("");
    const [addEndDate, setAddEndDate] = useState("");
    const [addReason, setAddReason] = useState("");
    const [addingLeave, setAddingLeave] = useState(false);
    const [addError, setAddError] = useState("");

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            const res = await fetch("/api/admin/student-leaves");
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (err) {
            console.error("Failed to fetch student leaves", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: "APPROVED" | "REJECTED") => {
        setProcessingId(id);
        try {
            const res = await fetch("/api/admin/student-leaves", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    status: newStatus,
                    reviewNote: notes[id] || undefined,
                }),
            });

            if (res.ok) {
                const updatedRequest = await res.json();
                setRequests(requests.map(req => req.id === id ? updatedRequest : req));
                setNotes(prev => {
                    const copy = { ...prev };
                    delete copy[id];
                    return copy;
                });
            }
        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteLeave = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this leave request permanently? It will be removed from all records.")) {
            return;
        }

        setProcessingId(id);
        try {
            const res = await fetch(`/api/admin/student-leaves?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setRequests(prev => prev.filter(r => r.id !== id));
            } else {
                const err = await res.json();
                alert(err.error || "Failed to delete leave request.");
            }
        } catch (err) {
            console.error("Failed to delete leave request", err);
            alert("An error occurred while deleting leave request.");
        } finally {
            setProcessingId(null);
        }
    };

    const openAddLeaveModal = async () => {
        setIsAddLeaveModalOpen(true);
        setAddError("");
        if (allBatchStudents.length === 0) {
            setFetchingStudents(true);
            try {
                const res = await fetch("/api/batch-info?all=true");
                if (res.ok) {
                    const data = await res.json();
                    setAllBatchStudents(data);
                }
            } catch (err) {
                console.error("Failed to fetch batch students:", err);
            } finally {
                setFetchingStudents(false);
            }
        }
    };

    const formatDateSafe = (dateStr: string) => {
        if (!dateStr) return "";
        const [y, m, d] = dateStr.split("-").map(Number);
        if (y && m && d) {
            return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        }
        return new Date(dateStr).toLocaleDateString();
    };

    const runningBatchesList = useMemo(() => {
        const runningStudents = allBatchStudents.filter(s => s.batchType !== "Completed");
        const set = new Set(runningStudents.map(s => s.batchName).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    }, [allBatchStudents]);

    const studentsForSelectedAddBatch = useMemo(() => {
        if (!addBatchName) return [];
        return allBatchStudents
            .filter(s => s.batchName === addBatchName && s.batchType !== "Completed")
            .sort((a, b) => a.roll.localeCompare(b.roll, undefined, { numeric: true, sensitivity: "base" }));
    }, [allBatchStudents, addBatchName]);

    useEffect(() => {
        if (runningBatchesList.length > 0 && (!addBatchName || !runningBatchesList.includes(addBatchName))) {
            setAddBatchName(runningBatchesList[0]);
        }
    }, [runningBatchesList, addBatchName]);

    useEffect(() => {
        if (studentsForSelectedAddBatch.length > 0) {
            setAddStudentRoll(studentsForSelectedAddBatch[0].roll);
        } else {
            setAddStudentRoll("");
        }
    }, [studentsForSelectedAddBatch]);

    const handleAddLeaveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError("");

        if (!addBatchName || !addStudentRoll || !addStartDate || !addEndDate || !addReason) {
            setAddError("Please fill out all required fields.");
            return;
        }

        setAddingLeave(true);
        try {
            const res = await fetch("/api/admin/student-leaves", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    batchName: addBatchName,
                    studentRoll: addStudentRoll,
                    startDate: addStartDate,
                    endDate: addEndDate,
                    reason: addReason,
                    status: "APPROVED",
                }),
            });

            if (res.ok) {
                const newReq = await res.json();
                setRequests([newReq, ...requests]);
                setIsAddLeaveModalOpen(false);
                setAddStartDate("");
                setAddEndDate("");
                setAddReason("");
            } else {
                const errData = await res.json();
                setAddError(errData.error || "Failed to add leave request.");
            }
        } catch (err) {
            console.error("Error adding leave request:", err);
            setAddError("An error occurred while adding leave request.");
        } finally {
            setAddingLeave(false);
        }
    };

    const uniqueBatches = useMemo(() => {
        const set = new Set(requests.map(r => r.studentBatchName).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    }, [requests]);

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = !query ||
                (req.studentName && req.studentName.toLowerCase().includes(query)) ||
                (req.studentRoll && req.studentRoll.toLowerCase().includes(query)) ||
                (req.studentPhone && req.studentPhone.toLowerCase().includes(query)) ||
                (req.reason && req.reason.toLowerCase().includes(query));

            const matchesBatch = selectedBatch === "ALL" || req.studentBatchName === selectedBatch;

            return matchesSearch && matchesBatch;
        });
    }, [requests, searchQuery, selectedBatch]);

    const studentsForExportModal = useMemo(() => {
        const map = new Map<string, { roll: string; name: string; batch: string }>();
        const targetReqs = exportBatch === "ALL" 
            ? requests 
            : requests.filter(r => r.studentBatchName === exportBatch);

        targetReqs.forEach(r => {
            const key = `${r.studentBatchName}_${r.studentRoll}`;
            if (!map.has(key)) {
                map.set(key, { roll: r.studentRoll, name: r.studentName, batch: r.studentBatchName });
            }
        });

        return Array.from(map.values()).sort((a, b) => 
            a.roll.localeCompare(b.roll, undefined, { numeric: true, sensitivity: "base" })
        );
    }, [requests, exportBatch]);

    useEffect(() => {
        if (studentsForExportModal.length > 0 && !exportStudentRoll) {
            setExportStudentRoll(studentsForExportModal[0].roll);
        }
    }, [studentsForExportModal, exportStudentRoll]);

    const getLeaveDays = (startDateStr: string, endDateStr: string): number => {
        try {
            const start = new Date(startDateStr);
            const end = new Date(endDateStr);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return isNaN(diffDays) ? 1 : diffDays;
        } catch {
            return 1;
        }
    };

    const handleExecuteExport = async () => {
        try {
            let exportRecords: LeaveRequest[] = [];
            let fileName = "";

            if (exportTargetType === "batch") {
                exportRecords = exportBatch === "ALL"
                    ? requests
                    : requests.filter(r => r.studentBatchName === exportBatch);
                fileName = `Leave_Records_${exportBatch === "ALL" ? "All_Batches" : exportBatch}_${new Date().toISOString().split("T")[0]}.xlsx`;
            } else {
                exportRecords = requests.filter(r => {
                    const matchesBatch = exportBatch === "ALL" || r.studentBatchName === exportBatch;
                    const matchesRoll = r.studentRoll === exportStudentRoll;
                    return matchesBatch && matchesRoll;
                });
                const studentObj = exportRecords[0];
                const studentNameClean = studentObj ? studentObj.studentName.replace(/\s+/g, "_") : "Student";
                fileName = `Leave_Record_${studentNameClean}_Roll_${exportStudentRoll}_${new Date().toISOString().split("T")[0]}.xlsx`;
            }

            if (exportRecords.length === 0) {
                alert("No leave records found matching the selected export options.");
                return;
            }

            // Loaded on demand — XLSX is a large library and this handler
            // only runs when the user actually asks to export.
            const XLSX = await import("xlsx");
            const wb = XLSX.utils.book_new();
            const sheetData: (string | number)[][] = [];

            sheetData.push(["Student Leave Records Export"]);
            sheetData.push([
                `Filter Type: ${exportTargetType === "batch" ? "Whole Batch" : "Single Student"}`,
                `Selected Batch: ${exportBatch}`,
                `Exported Records: ${exportRecords.length}`
            ]);
            sheetData.push([`Generated on: ${new Date().toLocaleString()}`]);
            sheetData.push([]);

            sheetData.push([
                "Student Name",
                "Roll Number",
                "Mobile Number",
                "Batch Name",
                "Start Date",
                "End Date",
                "Total Days",
                "Status",
                "Student Reason / Note",
                "Admin Note",
                "Submitted Date"
            ]);

            exportRecords.forEach(req => {
                const days = getLeaveDays(req.startDate, req.endDate);
                sheetData.push([
                    req.studentName || "-",
                    req.studentRoll || "-",
                    req.studentPhone || "-",
                    req.studentBatchName || "-",
                    formatDateSafe(req.startDate),
                    formatDateSafe(req.endDate),
                    days,
                    req.status,
                    req.reason || "-",
                    req.reviewNote || "-",
                    new Date(req.createdAt).toLocaleDateString()
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(sheetData);

            ws['!cols'] = [
                { wch: 25 }, // Student Name
                { wch: 15 }, // Roll Number
                { wch: 18 }, // Mobile Number
                { wch: 16 }, // Batch Name
                { wch: 14 }, // Start Date
                { wch: 14 }, // End Date
                { wch: 14 }, // Total Days
                { wch: 14 }, // Status
                { wch: 35 }, // Reason
                { wch: 30 }, // Admin Note
                { wch: 16 }, // Submitted Date
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Leave Records");
            XLSX.writeFile(wb, fileName);
            setIsExportModalOpen(false);
        } catch (err) {
            console.error("Failed to export leave records to Excel:", err);
            alert("Failed to export Excel file.");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Student Leave Requests</h1>
                        <p className="text-slate-500 text-sm">Manage and review leave applications submitted by students.</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={openAddLeaveModal}
                            className="px-4 py-2.5 bg-[#059669] hover:bg-[#10b981] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Add Leave
                        </button>
                    </div>
                </div>

                {/* Search & Filter Bar Card (Matching User Design) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col md:flex-row gap-3 items-center">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <MagnifyingGlassIcon className="h-5 w-5" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search student by Name, Roll, or Phone Number..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#059669] focus:border-[#059669] text-sm transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Batch Selection Filter Dropdown */}
                    <div className="w-full md:w-64 shrink-0">
                        <select
                            value={selectedBatch}
                            onChange={(e) => setSelectedBatch(e.target.value)}
                            className="block w-full py-2.5 px-3 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-[#059669] text-sm transition-colors text-slate-700 font-medium"
                        >
                            <option value="ALL">💳 All Batches</option>
                            {uniqueBatches.map((b) => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>

                    {/* Download Button */}
                    <div className="shrink-0 w-full md:w-auto">
                        <button
                            onClick={() => {
                                setExportBatch(selectedBatch === "ALL" ? (uniqueBatches[0] || "ALL") : selectedBatch);
                                setIsExportModalOpen(true);
                            }}
                            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f0fdf4] text-[#059669] border border-[#059669]/20 text-sm font-semibold rounded-xl hover:bg-[#dcfce7] transition-colors shadow-sm whitespace-nowrap cursor-pointer"
                            title="Download Data to Excel"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                            Download Data
                        </button>
                    </div>
                </div>

                {/* Main Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                                    <th className="p-4">Student Details</th>
                                    <th className="p-4 text-center">Date Range & Days</th>
                                    <th className="p-4">Reason</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                                            No student leave requests found matching your search or filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map((req) => {
                                        const leaveDays = getLeaveDays(req.startDate, req.endDate);
                                        return (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 align-top">
                                                    <div className="font-semibold text-slate-800 text-sm">{req.studentName}</div>
                                                    <div className="text-xs text-slate-500 font-medium mt-0.5">Roll: {req.studentRoll}</div>
                                                    {req.studentPhone && (
                                                        <div className="text-xs text-blue-600 font-mono mt-0.5 flex items-center gap-1 font-medium">
                                                            <span>📱</span> {req.studentPhone}
                                                        </div>
                                                    )}
                                                    <div className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md inline-block mt-1 font-medium">
                                                        {req.studentBatchName}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top text-center">
                                                    <div className="text-xs text-slate-700 whitespace-nowrap font-medium">
                                                        {formatDateSafe(req.startDate)} <br />
                                                        <span className="text-slate-400 font-normal">to</span> <br />
                                                        {formatDateSafe(req.endDate)}
                                                    </div>
                                                    <div className="mt-1 inline-block text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                        {leaveDays} {leaveDays === 1 ? "Day" : "Days"}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top max-w-xs">
                                                    <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                                                        {req.reason}
                                                    </div>
                                                    {req.attachmentUrl && (
                                                        <div className="mt-2">
                                                            <a
                                                                href={req.attachmentUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg border border-blue-100 font-medium transition-colors break-all"
                                                            >
                                                                <span>📎</span>
                                                                <span className="truncate max-w-[200px]">{req.attachmentName || "View Attachment"}</span>
                                                            </a>
                                                        </div>
                                                    )}
                                                    {req.reviewNote && (
                                                        <div className="mt-2 text-xs bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-100 leading-relaxed">
                                                            <strong>Admin Note:</strong> {req.reviewNote}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 align-top text-center">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full inline-block ${
                                                            req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                            req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                            {req.status}
                                                        </span>
                                                        <div className="text-[11px] text-slate-400 mt-2 text-center">
                                                            Submitted:<br />
                                                            {new Date(req.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top text-center min-w-[240px]">
                                                    <div className="space-y-2 max-w-xs mx-auto">
                                                        {req.status === "PENDING" && (
                                                            <>
                                                                <input 
                                                                    type="text" 
                                                                    value={notes[req.id] || ""}
                                                                    onChange={(e) => setNotes({ ...notes, [req.id]: e.target.value })}
                                                                    placeholder="Add a note (optional)"
                                                                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                                                />
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleUpdateStatus(req.id, "APPROVED")}
                                                                        disabled={processingId === req.id}
                                                                        className="flex-1 py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                                                                    >
                                                                        {processingId === req.id ? "..." : "Approve"}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleUpdateStatus(req.id, "REJECTED")}
                                                                        disabled={processingId === req.id}
                                                                        className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                                                                    >
                                                                        {processingId === req.id ? "..." : "Reject"}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteLeave(req.id)}
                                                                        disabled={processingId === req.id}
                                                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                                                                        title="Delete Leave Request Permanently"
                                                                    >
                                                                        <TrashIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                        {req.status !== "PENDING" && (
                                                            <div className="flex justify-center">
                                                                <button
                                                                    onClick={() => handleDeleteLeave(req.id)}
                                                                    disabled={processingId === req.id}
                                                                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-medium rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                                                                    title="Delete Leave Request Permanently"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                    <span>Delete Record</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Admin Add Leave Modal */}
            {isAddLeaveModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsAddLeaveModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2 text-[#059669]">
                                <PlusIcon className="w-6 h-6" />
                                <h3 className="text-lg font-bold text-slate-800">Add Student Leave</h3>
                            </div>
                            <button
                                onClick={() => setIsAddLeaveModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {addError && (
                            <div className="p-3 text-xs bg-red-50 text-red-600 rounded-xl border border-red-100 font-medium">
                                {addError}
                            </div>
                        )}

                        {fetchingStudents ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
                            </div>
                        ) : (
                            <form onSubmit={handleAddLeaveSubmit} className="space-y-4">
                                {/* Running Batch Selection */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                                        ১. রানিং ব্যাচ সিলেক্ট করুন *
                                    </label>
                                    {runningBatchesList.length === 0 ? (
                                        <div className="p-3 text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                                            কোনো রানিং ব্যাচ পাওয়া যায়নি।
                                        </div>
                                    ) : (
                                        <select
                                            value={addBatchName}
                                            onChange={(e) => setAddBatchName(e.target.value)}
                                            className="w-full p-2.5 text-xs border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white text-slate-800 font-medium"
                                            required
                                        >
                                            {runningBatchesList.map((b) => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Student Selection */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                                        ২. স্টুডেন্ট সিলেক্ট করুন *
                                    </label>
                                    {studentsForSelectedAddBatch.length === 0 ? (
                                        <div className="p-3 text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                                            এই ব্যাচে কোনো শিক্ষার্থী পাওয়া যায়নি।
                                        </div>
                                    ) : (
                                        <select
                                            value={addStudentRoll}
                                            onChange={(e) => setAddStudentRoll(e.target.value)}
                                            className="w-full p-2.5 text-xs border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white text-slate-800 font-medium"
                                            required
                                        >
                                            {studentsForSelectedAddBatch.map((st) => (
                                                <option key={`${st.batchName}_${st.roll}`} value={st.roll}>
                                                    Roll: {st.roll} — {st.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Start Date & End Date */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                                            শুরুর তারিখ *
                                        </label>
                                        <input
                                            type="date"
                                            value={addStartDate}
                                            onChange={(e) => setAddStartDate(e.target.value)}
                                            className="w-full p-2 text-xs border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white text-slate-800"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                                            শেষের তারিখ *
                                        </label>
                                        <input
                                            type="date"
                                            value={addEndDate}
                                            onChange={(e) => setAddEndDate(e.target.value)}
                                            className="w-full p-2 text-xs border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white text-slate-800"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Reason / Note */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                                        ছুটির কারণ / নোট *
                                    </label>
                                    <textarea
                                        value={addReason}
                                        onChange={(e) => setAddReason(e.target.value)}
                                        rows={3}
                                        placeholder="ছুটির কারণ বা নোট লিখুন..."
                                        className="w-full p-2.5 text-xs border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white text-slate-800"
                                        required
                                    ></textarea>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddLeaveModalOpen(false)}
                                        className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                                    >
                                        বাতিল
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={addingLeave || studentsForSelectedAddBatch.length === 0}
                                        className="flex-1 py-2.5 px-4 bg-[#059669] hover:bg-[#10b981] text-white text-xs font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        {addingLeave ? "Adding..." : "Add Leave"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Interactive Download Modal */}
            {isExportModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsExportModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2 text-[#059669]">
                                <ArrowDownTrayIcon className="w-6 h-6" />
                                <h3 className="text-lg font-bold text-slate-800">Download Leave Records</h3>
                            </div>
                            <button
                                onClick={() => setIsExportModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Step 1: Export Target Type Selection */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                ১. কি ধরনের ডাটা ডাউনলোড করতে চান?
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setExportTargetType("batch")}
                                    className={`py-3 px-4 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                                        exportTargetType === "batch"
                                            ? "bg-[#f0fdf4] border-[#059669] text-[#059669] shadow-xs ring-2 ring-[#059669]/20"
                                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    🎓 একটি ব্যাচের ডাটা
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExportTargetType("student")}
                                    className={`py-3 px-4 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                                        exportTargetType === "student"
                                            ? "bg-[#f0fdf4] border-[#059669] text-[#059669] shadow-xs ring-2 ring-[#059669]/20"
                                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    👤 নির্দিষ্ট স্টুডেন্টের ডাটা
                                </button>
                            </div>
                        </div>

                        {/* Step 2: Batch Selection */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                ২. ব্যাচ সিলেক্ট করুন:
                            </label>
                            <select
                                value={exportBatch}
                                onChange={(e) => {
                                    setExportBatch(e.target.value);
                                    setExportStudentRoll("");
                                }}
                                className="w-full p-2.5 text-xs border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white text-slate-800 font-medium"
                            >
                                {exportTargetType === "batch" && <option value="ALL">💳 All Batches (সকল ব্যাচ)</option>}
                                {uniqueBatches.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>

                        {/* Step 3: Student Selection (if Single Student chosen) */}
                        {exportTargetType === "student" && (
                            <div className="space-y-2">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                    ৩. স্টুডেন্ট সিলেক্ট করুন:
                                </label>
                                {studentsForExportModal.length === 0 ? (
                                    <div className="p-3 text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                                        এই ব্যাচে কোনো ছুটির আবেদন পাওয়া যায়নি।
                                    </div>
                                ) : (
                                    <select
                                        value={exportStudentRoll}
                                        onChange={(e) => setExportStudentRoll(e.target.value)}
                                        className="w-full p-2.5 text-xs border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white text-slate-800 font-medium"
                                    >
                                        {studentsForExportModal.map((st) => (
                                            <option key={`${st.batch}_${st.roll}`} value={st.roll}>
                                                Roll: {st.roll} — {st.name} ({st.batch})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                            >
                                বাতিল
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteExport}
                                disabled={exportTargetType === "student" && studentsForExportModal.length === 0}
                                className="flex-1 py-2.5 px-4 bg-[#059669] hover:bg-[#10b981] text-white text-xs font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                এক্সেল ডাউনলোড করুন
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
