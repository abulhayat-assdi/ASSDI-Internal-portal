"use client";

import { useState, useEffect } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import AdminRoute from "@/components/auth/AdminRoute";
import * as adminService from "@/services/adminService";
import * as teacherService from "@/services/teacherService";
import * as feedbackService from "@/services/feedbackService";
import { getClassesByTeacherId } from "@/services/scheduleService";
import { formatDateShort } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";

export default function AdminPage() {
    const confirm = useConfirm();
    // State - User Management now uses allTeachers from Firestore
    const [stats, setStats] = useState<adminService.AdminStats>({
        totalUsers: 0,
        totalNotices: 0,
        totalResources: 0,
        totalFeedback: 0,
        pendingFeedback: 0,
        pendingClasses: 0
    });

    const [recentActivity, setRecentActivity] = useState<adminService.ActivityLog[]>([]);
    const [pendingClasses, setPendingClasses] = useState<adminService.ClassSession[]>([]);
    const [allTeachers, setAllTeachers] = useState<teacherService.Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [showLogs, setShowLogs] = useState(false);
    const [showPendingClasses, setShowPendingClasses] = useState(false); // Default Hidden
    const [showPendingFeedback, setShowPendingFeedback] = useState(false); // Default Hidden
    const [pendingFeedbacks, setPendingFeedbacks] = useState<feedbackService.Feedback[]>([]);

    // Filter & Selection State
    const [filterTeacher, setFilterTeacher] = useState<string>("All");
    const [filterBatch, setFilterBatch] = useState<string>("All");
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

    // Sheet Classes State (to merge with Firestore PENDING)
    const [sheetPendingClasses, setSheetPendingClasses] = useState<adminService.ClassSession[]>([]);
    const [, setFetchingSheet] = useState(false); // Unused strict check

    const { user } = useAuth();

    // Load Initial Data (excluding feedback which uses realtime)
    const loadData = async () => {
        setLoading(true);
        const [statsData, activityData, classesData, teachersData] = await Promise.all([
            adminService.getAdminStats(),
            adminService.getRecentActivity(),
            adminService.getPendingClasses(),
            teacherService.getAllTeachers()
        ]);
        setStats(statsData);
        setRecentActivity(activityData);
        setPendingClasses(classesData);
        setAllTeachers(teachersData);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // REAL-TIME: Subscribe to unread feedback
    useEffect(() => {
        const unsubscribe = feedbackService.subscribeToUnreadFeedback((feedbacks) => {
            setPendingFeedbacks(feedbacks);
        });

        // Cleanup: unsubscribe when component unmounts
        return () => unsubscribe();
    }, []);

    // Fetch Sheet Classes when Teacher is selected
    useEffect(() => {
        const fetchSheetClasses = async () => {
            // New Logic: If "All", we fetch EVERYTHING using special "ALL" ID
            // If specific, we fetch specific.

            const targetId = filterTeacher === "All" ? "ALL" : allTeachers.find(t => t.name === filterTeacher)?.teacherId;

            if (!targetId) return;

            setFetchingSheet(true);
            try {
                // Fetch full schedule from API
                // We use our existing service function which calls the API.
                // NOTE: We rely on the API change we just made where "ALL" returns all rows.
                const schedules = await getClassesByTeacherId(targetId);

                // Filter for "Pending" status from the sheet calculation
                const pendings = schedules.filter(s => s.status === "Pending");

                // Map to ClassSession format
                const mapped: adminService.ClassSession[] = pendings.map(s => ({
                    id: `sheet_${s.date}_${s.time}_${s.batch}`, // Virtual ID
                    teacherUid: s.teacherId || "unknown", // Use ID from sheet row
                    teacherName: s.teacherName || "Unknown",
                    date: s.date,
                    startTime: s.time.split(/[-–]/)[0]?.trim() || s.time,
                    endTime: s.time.split(/[-–]/)[1]?.trim() || "",
                    timeRange: s.time,
                    batch: s.batch,
                    subject: s.subject,
                    status: "PENDING"
                }));

                setSheetPendingClasses(mapped);
            } catch (err) {
                console.error("Failed to fetch sheet classes", err);
            }
            setFetchingSheet(false);
        };

        fetchSheetClasses();
    }, [filterTeacher, allTeachers]);

    // Derived Logic: Merge Firestore PENDING with Sheet PENDING
    const mergedClasses = [...pendingClasses];

    // Add sheet classes only if they don't already exist in Firestore (deduplication)
    sheetPendingClasses.forEach(sheetCls => {
        const exists = pendingClasses.some(fc =>
            fc.date === sheetCls.date &&
            fc.batch === sheetCls.batch &&
            fc.subject === sheetCls.subject
        );
        if (!exists) {
            mergedClasses.push(sheetCls);
        }
    });

    // Unique Batch List from Merged Data (so we can filter by new batches found in sheet)
    const uniqueBatches = Array.from(new Set(mergedClasses.map(c => c.batch))).sort();

    // Apply Filters
    const filteredClasses = mergedClasses.filter(cls => {
        const matchesTeacher = filterTeacher === "All" || cls.teacherName === filterTeacher;
        const matchesBatch = filterBatch === "All" || cls.batch === filterBatch;
        return matchesTeacher && matchesBatch;
    });

    // --- Actions ---

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedClasses(filteredClasses.map(c => c.id));
        } else {
            setSelectedClasses([]);
        }
    };

    const handleSelectClass = (classId: string) => {
        setSelectedClasses(prev =>
            prev.includes(classId)
                ? prev.filter(id => id !== classId)
                : [...prev, classId]
        );
    };

    const handleMarkComplete = async (cls: adminService.ClassSession) => {
        if (!user) return;
        setLoading(true);
        try {
            await adminService.markClassComplete(cls.id, user.id, cls);
            alert("Class marked as complete");
            loadData(); // Refresh stats and lists
        } catch (error) {
            console.error(error);
            alert("Failed to mark class as complete");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkComplete = async () => {
        if (!user || selectedClasses.length === 0) return;

        const ok = await confirm({ message: `Are you sure you want to mark ${selectedClasses.length} classes as complete?`, variant: "warning" });
        if (!ok) return;

        setLoading(true);
        try {
            await Promise.all(selectedClasses.map(async (id) => {
                const cls = filteredClasses.find(c => c.id === id);
                if (!cls) return;

                // We reuse the logic effectively, but wait, calling handleMarkComplete 
                // inside loop with loading state toggles might be jittery or race-condition prone.
                // Ideally we should build a single BATCH for all, but for mixed types (virtual vs real) it's complex.
                // We'll execute creating documents sequentially or parallel.

                // Simplified: Reuse functionality but suppress individual loading toggles? 
                // Hard to refactor quickly. We will just run them. The UI loading overlay covers it.

                if (cls.id.startsWith('sheet_')) {
                    // Inline logic for Batch Sheet complete to avoid `handleMarkComplete` state conflict?
                    // Actually calling `handleMarkComplete` sets loading=true then false.
                    // The outer `handleBulkComplete` sets loading=true.
                    // It might flicker. But it works.
                    await handleMarkComplete(cls);
                } else {
                    await adminService.markClassComplete(cls.id, user.id);
                }
            }));

            await loadData();
            setSelectedClasses([]);
        } catch (error) {
            console.error(error);
            alert("Failed to complete some classes.");
        }
        setLoading(false);
    };

    return (
        <AdminRoute>
            <div className="space-y-8">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                        <div>
                            <h1 className="text-3xl font-bold text-[#1f2937]">
                                Admin Panel
                            </h1>
                            <p className="text-[#6b7280] mt-1">
                                Manage users, notices, and system settings
                            </p>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-[#1f2937]">{loading ? "..." : stats.totalUsers}</p>
                                    <p className="text-sm text-[#6b7280] mt-1">Total Users</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-[#ec4899] to-[#f472b6] rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-[#1f2937]">{loading ? "..." : stats.totalNotices}</p>
                                    <p className="text-sm text-[#6b7280] mt-1">Total Notices</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-[#06b6d4] to-[#22d3ee] rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-[#1f2937]">{loading ? "..." : stats.totalResources}</p>
                                    <p className="text-sm text-[#6b7280] mt-1">Total Resources</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-[#10b981] to-[#34d399] rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-[#1f2937]">{loading ? "..." : stats.totalFeedback}</p>
                                    <p className="text-sm text-[#6b7280] mt-1">Total Feedback</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Recent Admin Activity Section */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardBody className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <svg className="w-6 h-6 text-[#059669]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#1f2937]">Recent Admin Activity</h3>
                                    <p className="text-sm text-[#6b7280] mt-1">View recent administrative actions and system logs</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLogs(!showLogs)}
                                className="px-4 py-2 border-2 border-[#059669] text-[#059669] font-semibold rounded-lg hover:bg-[#059669] hover:text-white transition-colors">
                                {showLogs ? "Hide Logs" : "Show Logs"}
                            </button>
                        </div>

                        {showLogs && (
                            <div className="mt-4 space-y-3 bg-gray-50 p-4 rounded-lg">
                                {recentActivity.length > 0 ? (
                                    recentActivity.map((log) => (
                                        <div key={log.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{log.description}</p>
                                                <p className="text-xs text-gray-500">
                                                    Action: {log.actionType} | Target: {log.targetType}
                                                </p>
                                            </div>
                                            <span className="text-xs text-gray-400">
                                                {log.createdAt ? formatDateShort(new Date(log.createdAt as any).toISOString()) : 'Just now'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 text-center">No recent activity logs.</p>
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Manage Pending Classes Section */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardBody className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <svg className="w-6 h-6 text-[#f59e0b]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#1f2937]">Manage Pending Classes</h3>
                                    <p className="text-sm text-[#6b7280] mt-1">Review and complete pending classes ({stats.pendingClasses})</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPendingClasses(!showPendingClasses)}
                                className="px-4 py-2 border-2 border-[#059669] text-[#059669] font-semibold rounded-lg hover:bg-[#059669] hover:text-white transition-colors">
                                {showPendingClasses ? "Hide Pending Classes" : "Show Pending Classes"}
                            </button>
                        </div>

                        {showPendingClasses && (
                            <div className="mt-4 space-y-4">
                                {/* Filters & Actions Toolbar */}
                                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 p-4 rounded-lg">
                                    <div className="flex gap-3 w-full md:w-auto">
                                        <select
                                            value={filterTeacher}
                                            onChange={(e) => setFilterTeacher(e.target.value)}
                                            className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[#059669] outline-none"
                                        >
                                            <option value="All">All Teachers</option>
                                            {allTeachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                        </select>

                                        <select
                                            value={filterBatch}
                                            onChange={(e) => setFilterBatch(e.target.value)}
                                            className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[#059669] outline-none"
                                        >
                                            <option value="All">All Batches</option>
                                            {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>

                                    {selectedClasses.length > 0 && (
                                        <button
                                            onClick={handleBulkComplete}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold shadow-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Mark {selectedClasses.length} Complete
                                        </button>
                                    )}
                                </div>
                                <div className="border rounded-lg overflow-hidden overflow-x-auto max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-left text-sm text-gray-600">
                                        <thead className="bg-gray-100 text-gray-700 uppercase font-semibold">
                                            <tr>
                                                <th className="px-4 py-3 w-4">
                                                    <input
                                                        type="checkbox"
                                                        onChange={handleSelectAll}
                                                        checked={filteredClasses.length > 0 && selectedClasses.length === filteredClasses.length}
                                                        className="w-4 h-4 rounded text-[#059669] focus:ring-[#059669]"
                                                    />
                                                </th>
                                                <th className="px-4 py-3">Teacher</th>
                                                <th className="px-4 py-3">Date & Time</th>
                                                <th className="px-4 py-3">Batch & Subject</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {filteredClasses.length > 0 ? (
                                                filteredClasses.map((cls) => (
                                                    <tr key={cls.id} className={`hover:bg-gray-50 ${selectedClasses.includes(cls.id) ? 'bg-green-50' : ''}`}>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedClasses.includes(cls.id)}
                                                                onChange={() => handleSelectClass(cls.id)}
                                                                className="w-4 h-4 rounded text-[#059669] focus:ring-[#059669]"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-gray-900">
                                                            {cls.teacherName}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {cls.date} <br />
                                                            <span className="text-xs text-gray-500">{cls.startTime} - {cls.endTime}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded mr-1">
                                                                {cls.batch}
                                                            </span>
                                                            {cls.subject}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {cls.status === "REQUEST_TO_COMPLETE" ? (
                                                                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded">
                                                                    Requesting
                                                                </span>
                                                            ) : (
                                                                <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-0.5 rounded">
                                                                    Pending
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                onClick={() => handleMarkComplete(cls)}
                                                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-3 rounded"
                                                            >
                                                                ✓ Mark Co.
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                                                        No classes match your filter.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Pending Feedbacks Review */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardBody className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <svg className="w-6 h-6 text-[#3b82f6]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#1f2937]">
                                        Unread Feedback ({pendingFeedbacks.length})
                                    </h3>
                                    <p className="text-sm text-[#6b7280] mt-1">Anonymous course feedback from running batches — identity is never shown here</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href="/dashboard/feedback"
                                    className="px-4 py-2 bg-[#059669] text-white font-semibold rounded-lg hover:bg-[#047857] transition-colors"
                                >
                                    Open Feedback
                                </a>
                                <button
                                    onClick={() => setShowPendingFeedback(!showPendingFeedback)}
                                    className="px-4 py-2 border-2 border-[#059669] text-[#059669] font-semibold rounded-lg hover:bg-[#059669] hover:text-white transition-colors"
                                >
                                    {showPendingFeedback ? "Hide" : "Preview"}
                                </button>
                            </div>
                        </div>

                        {showPendingFeedback && (
                            <div className="mt-4 max-h-[400px] overflow-y-auto space-y-3">
                                {pendingFeedbacks.length > 0 ? (
                                    pendingFeedbacks.map((fb) => (
                                        <div key={fb.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                                                            {fb.batchName}
                                                        </span>
                                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                                                            {fb.category}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {fb.createdAt ? formatDateShort(new Date(fb.createdAt as any).toISOString()) : "Just now"}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-700 text-sm leading-relaxed">{fb.message}</p>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await feedbackService.setFeedbackRead(fb.id, true);
                                                                setPendingFeedbacks(prev => prev.filter(f => f.id !== fb.id));
                                                            } catch {
                                                                alert("Failed to update feedback");
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                                                    >
                                                        ✓ Mark Read
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const ok = await confirm({ message: "Are you sure you want to delete this feedback?", variant: "danger" });
                                                            if (ok) {
                                                                try {
                                                                    await feedbackService.deleteFeedback(fb.id);
                                                                    setPendingFeedbacks(prev => prev.filter(f => f.id !== fb.id));
                                                                } catch {
                                                                    alert("Failed to delete feedback");
                                                                }
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded hover:bg-red-100 transition-colors"
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-gray-500 py-8">No unread feedback.</p>
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* User Management Table - Real Teachers from Firestore */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-[#1f2937]">User Management</h2>
                        <span className="text-sm text-gray-500">{allTeachers.length} Users</span>
                    </div>
                    <Card>
                        <CardBody className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[#1e3a5f]">
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-white border border-[#2d5278]">
                                                ID
                                            </th>
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-white border border-[#2d5278]">
                                                Name
                                            </th>
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-white border border-[#2d5278]">
                                                Designation
                                            </th>
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-white border border-[#2d5278]">
                                                Email
                                            </th>
                                            <th className="px-6 py-4 text-center text-sm font-semibold text-white border border-[#2d5278]">
                                                Role
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allTeachers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                    No users found. Add teachers from the Teacher Directory.
                                                </td>
                                            </tr>
                                        ) : (
                                            allTeachers.map((teacher, index) => (
                                                <tr
                                                    key={teacher.id}
                                                    className={index % 2 === 0 ? "bg-white" : "bg-[#f9fafb]"}
                                                >
                                                    <td className="px-6 py-3 text-sm text-[#1f2937] font-medium border border-[#e5e7eb] text-center">
                                                        {teacher.teacherId}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-[#1f2937] font-medium border border-[#e5e7eb] text-center">
                                                        {teacher.name}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-[#6b7280] border border-[#e5e7eb] text-center">
                                                        {teacher.designation}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-[#6b7280] border border-[#e5e7eb] text-center">
                                                        {teacher.email}
                                                    </td>
                                                    <td className="px-6 py-3 border border-[#e5e7eb] text-center">
                                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${teacher.isAdmin
                                                            ? "bg-[#dbeafe] text-[#1e40af]"
                                                            : "bg-[#d1fae5] text-[#059669]"
                                                            }`}>
                                                            {teacher.isAdmin ? "Admin" : "Teacher"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </AdminRoute>
    );
}
