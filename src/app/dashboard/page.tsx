"use client";

import { CardBody } from "@/components/ui/Card";
import NoticeCard from "@/components/ui/NoticeCard";
import Badge from "@/components/ui/Badge";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Clock from "@/components/ui/Clock";
import {
    getAllNotices,
    addNotice,
    updateNotice,
    deleteNotice,
    addStudentNotice,
    getAllStudentNotices,
    updateStudentNotice,
    deleteStudentNotice,
    Notice,
    StudentNotice
} from "@/services/dashboardService";
import Button from "@/components/ui/Button";


export default function DashboardPage() {
    const { userProfile } = useAuth();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [studentNotices, setStudentNotices] = useState<StudentNotice[]>([]);
    const [loading, setLoading] = useState(true);

    // Add/Edit Notice State
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
    const [newNoticeTitle, setNewNoticeTitle] = useState("");
    const [newNoticeDescription, setNewNoticeDescription] = useState("");
    const [newNoticePriority, setNewNoticePriority] = useState<"normal" | "urgent">("normal");
    const [isAddingNotice, setIsAddingNotice] = useState(false);

    // Student Notice Modal State
    const [isStudentNoticeModalOpen, setIsStudentNoticeModalOpen] = useState(false);
    const [isEditStudentMode, setIsEditStudentMode] = useState(false);
    const [editingStudentNoticeId, setEditingStudentNoticeId] = useState<string | null>(null);
    const [studentNoticeTitle, setStudentNoticeTitle] = useState("");
    const [studentNoticeDescription, setStudentNoticeDescription] = useState("");
    const [studentNoticePriority, setStudentNoticePriority] = useState<"normal" | "urgent">("normal");
    const [isAddingStudentNotice, setIsAddingStudentNotice] = useState(false);

    // Delete Notice State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [noticeToDelete, setNoticeToDelete] = useState<Notice | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Delete Student Notice State
    const [isDeleteStudentModalOpen, setIsDeleteStudentModalOpen] = useState(false);
    const [studentNoticeToDelete, setStudentNoticeToDelete] = useState<StudentNotice | null>(null);
    const [isDeletingStudent, setIsDeletingStudent] = useState(false);

    // Fetch data from Firestore
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [noticesData, studentNoticesData] = await Promise.all([
                    getAllNotices(),
                    getAllStudentNotices(),
                ]);
                setNotices(noticesData);
                setStudentNotices(studentNoticesData);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleAddNotice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoticeTitle.trim() || !newNoticeDescription.trim()) return;

        setIsAddingNotice(true);
        try {
            if (isEditMode && editingNoticeId) {
                // Update existing notice
                await updateNotice(editingNoticeId, {
                    title: newNoticeTitle,
                    description: newNoticeDescription,
                    priority: newNoticePriority,
                });
            } else {
                // Add new notice
                const newNotice: Omit<Notice, "id"> = {
                    title: newNoticeTitle,
                    description: newNoticeDescription,
                    priority: newNoticePriority,
                    date: new Date().toISOString().split('T')[0],
                    createdBy: userProfile?.uid || "unknown",
                    createdByName: userProfile?.displayName || "Unknown",
                    createdAt: new Date().toISOString()
                };
                await addNotice(newNotice);
            }

            // Refresh notices
            const updatedNotices = await getAllNotices();
            setNotices(updatedNotices);

            // Close modal and reset form
            resetNoticeForm();
        } catch (error) {
            console.error("Error saving notice:", error);
            alert("Failed to save notice. Please try again.");
        } finally {
            setIsAddingNotice(false);
        }
    };

    // Reset form and close modal
    const resetNoticeForm = () => {
        setIsNoticeModalOpen(false);
        setIsEditMode(false);
        setEditingNoticeId(null);
        setNewNoticeTitle("");
        setNewNoticeDescription("");
        setNewNoticePriority("normal");
    };

    // Open edit modal
    const handleEditNotice = (notice: Notice) => {
        setIsEditMode(true);
        setEditingNoticeId(notice.id);
        setNewNoticeTitle(notice.title);
        setNewNoticeDescription(notice.description);
        setNewNoticePriority(notice.priority || "normal");
        setIsNoticeModalOpen(true);
    };

    // Open delete confirmation modal
    const handleDeleteClick = (notice: Notice) => {
        setNoticeToDelete(notice);
        setIsDeleteModalOpen(true);
    };

    // Confirm delete
    const handleDeleteNotice = async () => {
        if (!noticeToDelete) return;

        setIsDeleting(true);
        try {
            await deleteNotice(noticeToDelete.id);

            // Refresh notices
            const updatedNotices = await getAllNotices();
            setNotices(updatedNotices);

            // Close modal
            setIsDeleteModalOpen(false);
            setNoticeToDelete(null);
        } catch (error) {
            console.error("Error deleting notice:", error);
            alert("Failed to delete notice. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };

    // === STUDENT NOTICE HANDLERS ===
    const handleStudentNoticeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentNoticeTitle.trim() || !studentNoticeDescription.trim()) return;
        setIsAddingStudentNotice(true);
        try {
            if (isEditStudentMode && editingStudentNoticeId) {
                await updateStudentNotice(editingStudentNoticeId, {
                    title: studentNoticeTitle,
                    description: studentNoticeDescription,
                    priority: studentNoticePriority,
                });
            } else {
                await addStudentNotice({
                    title: studentNoticeTitle,
                    description: studentNoticeDescription,
                    priority: studentNoticePriority,
                    date: new Date().toISOString().split('T')[0],
                    createdBy: userProfile?.uid || "unknown",
                    createdByName: userProfile?.displayName || "Unknown",
                    createdAt: new Date().toISOString()
                });
            }
            setStudentNotices(await getAllStudentNotices());
            resetStudentNoticeForm();
        } catch (error) {
            console.error("Error saving student notice:", error);
            alert("Failed to save. Please try again.");
        } finally {
            setIsAddingStudentNotice(false);
        }
    };

    const resetStudentNoticeForm = () => {
        setIsStudentNoticeModalOpen(false);
        setIsEditStudentMode(false);
        setEditingStudentNoticeId(null);
        setStudentNoticeTitle("");
        setStudentNoticeDescription("");
        setStudentNoticePriority("normal");
    };

    const handleEditStudentNotice = (notice: StudentNotice) => {
        setIsEditStudentMode(true);
        setEditingStudentNoticeId(notice.id);
        setStudentNoticeTitle(notice.title);
        setStudentNoticeDescription(notice.description);
        setStudentNoticePriority(notice.priority || "normal");
        setIsStudentNoticeModalOpen(true);
    };

    const handleDeleteStudentClick = (notice: StudentNotice) => {
        setStudentNoticeToDelete(notice);
        setIsDeleteStudentModalOpen(true);
    };

    const handleDeleteStudentNotice = async () => {
        if (!studentNoticeToDelete) return;
        setIsDeletingStudent(true);
        try {
            await deleteStudentNotice(studentNoticeToDelete.id);
            setStudentNotices(await getAllStudentNotices());
            setIsDeleteStudentModalOpen(false);
            setStudentNoticeToDelete(null);
        } catch (error) {
            console.error("Error deleting student notice:", error);
            alert("Failed to delete. Please try again.");
        } finally {
            setIsDeletingStudent(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Animated Hero Card */}
            <div className="relative rounded-[20px] overflow-hidden" style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)"
            }}>
                {/* Floating Circles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute w-[80px] h-[80px] rounded-full bg-white opacity-10 top-[10%] left-[15%] animate-floatY"></div>
                    <div className="absolute w-[120px] h-[120px] rounded-full bg-white opacity-8 top-[60%] right-[20%] animate-floatY" style={{ animationDelay: "2s" }}></div>
                    <div className="absolute w-[60px] h-[60px] rounded-full bg-white opacity-12 bottom-[20%] left-[70%] animate-floatY" style={{ animationDelay: "4s" }}></div>
                    <div className="absolute w-[40px] h-[40px] rounded-full bg-white opacity-15 top-[30%] right-[10%] animate-floatY" style={{ animationDelay: "1s" }}></div>
                </div>

                <CardBody className="py-16 relative z-10">
                    <div className="text-white text-center">
                        <p className="no-gradient text-sm font-normal mb-2 opacity-90">Assalamu Alaikum,</p>
                        <h1 className="no-gradient text-white text-5xl font-bold mb-3">
                            {userProfile?.displayName || "User"}
                        </h1>
                        <p className="no-gradient text-white/90 mb-8 text-lg font-normal max-w-2xl mx-auto">
                            Comprehensive Portal for the Art of Sales & Marketing Course
                        </p>
                        <Clock />
                    </div>
                </CardBody>

                {/* Realistic Animated Wave SVG */}
                <div className="absolute bottom-0 left-0 right-0 w-full">
                    <svg className="w-full h-24" viewBox="0 0 1440 320" preserveAspectRatio="none">
                        {/* Wave Layer 1 - Lightest */}
                        <path
                            className="wave-path wave-1"
                            d="M0,160 C240,200 480,120 720,160 C960,200 1200,120 1440,160 L1440,160 C1680,200 1920,120 2160,160 C2400,200 2640,120 2880,160 L2880,320 L0,320 Z"
                            fill="rgba(248, 249, 250, 0.15)"
                        />

                        {/* Wave Layer 2 - Medium */}
                        <path
                            className="wave-path wave-2"
                            d="M0,180 C240,220 480,140 720,180 C960,220 1200,140 1440,180 L1440,180 C1680,220 1920,140 2160,180 C2400,220 2640,140 2880,180 L2880,320 L0,320 Z"
                            fill="rgba(248, 249, 250, 0.3)"
                        />

                        {/* Wave Layer 3 - Darkest/Solid */}
                        <path
                            className="wave-path wave-3"
                            d="M0,200 C240,240 480,160 720,200 C960,240 1200,160 1440,200 L1440,200 C1680,240 1920,160 2160,200 C2400,240 2640,160 2880,200 L2880,320 L0,320 Z"
                            fill="#f8f9fa"
                        />
                    </svg>
                </div>
            </div>

            {/* Notice Board */}
            <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-semibold text-[#1f2937] border-l-4 border-[#22c55e] pl-3">
                            Notice Board
                        </h2>
                        <Badge variant="default">
                            {loading ? "..." : `${notices.length} Notices`}
                        </Badge>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <Button
                            onClick={() => setIsNoticeModalOpen(true)}
                            size="sm"
                            className="bg-[#059669] hover:bg-[#047857] text-white"
                        >
                            + Add Notice
                        </Button>
                        <Button
                            onClick={() => setIsStudentNoticeModalOpen(true)}
                            size="sm"
                            className="bg-[#1e3a5f] hover:bg-[#162e4a] text-white"
                        >
                            📢 Add Notice for Students
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#059669]"></div>
                        <p className="mt-4 text-[#6b7280]">Loading notices...</p>
                    </div>
                ) : notices.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg shadow-soft">
                        <p className="text-[#6b7280]">No notices available</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {notices.map((notice) => (
                            <NoticeCard
                                key={notice.id}
                                notice={notice}
                                onEdit={handleEditNotice}
                                onDelete={handleDeleteClick}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Student Notice Board */}
            <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-semibold text-[#1f2937] border-l-4 border-[#1e3a5f] pl-3">
                            Student Notice
                        </h2>
                        <Badge variant="default">
                            {loading ? "..." : `${studentNotices.length} Notices`}
                        </Badge>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]"></div>
                        <p className="mt-4 text-[#6b7280]">Loading student notices...</p>
                    </div>
                ) : studentNotices.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg shadow-soft">
                        <p className="text-[#6b7280]">No student notices yet. Click {"\"Add Notice for Students\""} to post one.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {studentNotices.map((notice) => (
                            <div key={notice.id} className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${
                                notice.priority === 'urgent' ? 'border-red-500' : 'border-[#1e3a5f]'
                            } hover:shadow-md transition-shadow`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                        notice.priority === 'urgent' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-[#1e3a5f]'
                                    }`}>{notice.priority === 'urgent' ? '🔴 Urgent' : '📢 Student Notice'}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEditStudentNotice(notice)}
                                            className="text-gray-400 hover:text-blue-600 transition-colors text-sm"
                                        >Edit</button>
                                        <button
                                            onClick={() => handleDeleteStudentClick(notice)}
                                            className="text-gray-400 hover:text-red-600 transition-colors text-sm"
                                        >Delete</button>
                                    </div>
                                </div>
                                <h4 className="font-bold text-gray-900 mt-2">{notice.title}</h4>
                                <p className="text-gray-600 text-sm mt-1 leading-relaxed">{notice.description}</p>
                                <p className="text-xs text-gray-400 mt-3">By: {notice.createdByName} · {notice.date}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Notice Modal */}
            {isNoticeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={resetNoticeForm}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">
                                {isEditMode ? "Edit Notice" : "Add New Notice"}
                            </h3>
                            <button
                                onClick={resetNoticeForm}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleAddNotice} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={newNoticeTitle}
                                    onChange={(e) => setNewNoticeTitle(e.target.value)}
                                    placeholder="Enter notice title"
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#059669] focus:border-[#059669] outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={newNoticeDescription}
                                    onChange={(e) => setNewNoticeDescription(e.target.value)}
                                    placeholder="Enter notice details..."
                                    required
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#059669] focus:border-[#059669] outline-none transition-all resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <div className="flex gap-4">
                                    {(['normal', 'urgent'] as const).map((priority) => (
                                        <label key={priority} className="flex items-center cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="priority"
                                                value={priority}
                                                checked={newNoticePriority === priority}
                                                onChange={() => setNewNoticePriority(priority)}
                                                className="sr-only"
                                            />
                                            <div className={`
                                                px-4 py-2 rounded-lg text-sm font-medium capitalize border transition-all
                                                ${newNoticePriority === priority
                                                    ? priority === 'urgent'
                                                        ? 'bg-red-50 border-red-200 text-red-700'
                                                        : 'bg-gray-50 border-gray-200 text-gray-700'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                                            `}>
                                                {priority}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={resetNoticeForm}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isAddingNotice}
                                    className="w-full bg-[#059669] hover:bg-[#047857] text-white"
                                >
                                    {isAddingNotice ? "Saving..." : (isEditMode ? "Update Notice" : "Post Notice")}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && noticeToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Notice</h3>
                            <p className="text-gray-500 mb-6">
                                Are you sure you want to delete <strong>{"\""}{noticeToDelete.title}{"\""}</strong>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setIsDeleteModalOpen(false); setNoticeToDelete(null); }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteNotice}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Student Notice Add/Edit Modal */}
            {isStudentNoticeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={resetStudentNoticeForm}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">
                                {isEditStudentMode ? "Edit Student Notice" : "Add Notice for Students"}
                            </h3>
                            <button onClick={resetStudentNoticeForm} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                        </div>
                        <form onSubmit={handleStudentNoticeSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={studentNoticeTitle}
                                    onChange={(e) => setStudentNoticeTitle(e.target.value)}
                                    placeholder="Enter notice title"
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f] outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                <textarea
                                    value={studentNoticeDescription}
                                    onChange={(e) => setStudentNoticeDescription(e.target.value)}
                                    placeholder="Enter notice message for students..."
                                    required
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f] outline-none transition-all resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <div className="flex gap-4">
                                    {(['normal', 'urgent'] as const).map((priority) => (
                                        <label key={priority} className="flex items-center cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="studentPriority"
                                                value={priority}
                                                checked={studentNoticePriority === priority}
                                                onChange={() => setStudentNoticePriority(priority)}
                                                className="sr-only"
                                            />
                                            <div className={`
                                                px-4 py-2 rounded-lg text-sm font-medium capitalize border transition-all
                                                ${studentNoticePriority === priority
                                                    ? priority === 'urgent'
                                                        ? 'bg-red-50 border-red-200 text-red-700'
                                                        : 'bg-blue-50 border-blue-200 text-[#1e3a5f]'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                                            `}>
                                                {priority}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="w-full" onClick={resetStudentNoticeForm}>Cancel</Button>
                                <Button
                                    type="submit"
                                    disabled={isAddingStudentNotice}
                                    className="w-full bg-[#1e3a5f] hover:bg-[#162e4a] text-white"
                                >
                                    {isAddingStudentNotice ? "Saving..." : (isEditStudentMode ? "Update" : "Post to Students")}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Student Notice Modal */}
            {isDeleteStudentModalOpen && studentNoticeToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Student Notice</h3>
                            <p className="text-gray-500 mb-6">
                                Are you sure you want to delete <strong>{"\""}{studentNoticeToDelete.title}{"\""}</strong>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setIsDeleteStudentModalOpen(false); setStudentNoticeToDelete(null); }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                                >Cancel</button>
                                <button
                                    onClick={handleDeleteStudentNotice}
                                    disabled={isDeletingStudent}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                >{isDeletingStudent ? "Deleting..." : "Delete"}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .glassmorphic-pill {
                    background: rgba(255, 255, 255, 0.18);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    border-radius: 999px;
                }

                .shadow-soft {
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
                }

                @keyframes floatY {
                    0%, 100% {
                        transform: translateY(0px);
                    }
                    50% {
                        transform: translateY(-20px);
                    }
                }

                .animate-floatY {
                    animation: floatY 6s ease-in-out infinite;
                }

                /* Realistic Wave Animation */
                @keyframes wave {
                    0% {
                        transform: translateX(0) translateZ(0) scaleY(1);
                    }
                    50% {
                        transform: translateX(-25%) translateZ(0) scaleY(1.1);
                    }
                    100% {
                        transform: translateX(-50%) translateZ(0) scaleY(1);
                    }
                }

                .wave-path {
                    animation: wave 20s cubic-bezier(0.36, 0.45, 0.63, 0.53) infinite;
                }

                .wave-1 {
                    animation-duration: 25s;
                }

                .wave-2 {
                    animation-duration: 20s;
                    animation-delay: -5s;
                }

                .wave-3 {
                    animation-duration: 15s;
                    animation-delay: -2s;
                }
            `}</style>
        </div>
    );
}
