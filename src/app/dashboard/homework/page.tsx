"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import {
    getHomeworkByTeacher,
    deleteHomework,
    cleanupCompletedBatchHomework,
    HomeworkSubmission,
    UploadedFile,
    createHomeworkAssignment,
    getHomeworkAssignmentsByTeacher,
    deleteHomeworkAssignment,
    updateHomeworkAssignment,
    HomeworkAssignment,
    getAssignmentShares,
    shareAssignment,
    unshareAssignment,
    getShareableTeachers,
    getSubmissionsByAssignment,
    ShareableTeacher
} from "@/services/homeworkService";
import { getAllBatchInfo, getPublicUniqueBatches } from "@/services/batchInfoService";

export default function HomeworkViewPage() {
    const confirm = useConfirm();
    const { userProfile, loading: authLoading } = useAuth();

    // Data States
    const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
    const [allBatches, setAllBatches] = useState<string[]>([]);
    const [homework, setHomework] = useState<HomeworkSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
    const [assignmentTitle, setAssignmentTitle] = useState("");
    const [assignmentBatch, setAssignmentBatch] = useState("all");
    const [assignmentDeadline, setAssignmentDeadline] = useState("");
    const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

    // View States
    const [selectedFolder, setSelectedFolder] = useState<HomeworkAssignment | "other" | null>(null);
    const [viewingSubmission, setViewingSubmission] = useState<HomeworkSubmission | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [cleanupCount, setCleanupCount] = useState(0);

    const [assignmentToDelete, setAssignmentToDelete] = useState<HomeworkAssignment | null>(null);
    const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);

    const [assignmentToEdit, setAssignmentToEdit] = useState<HomeworkAssignment | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editBatch, setEditBatch] = useState("");
    const [editDeadline, setEditDeadline] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Search within folder
    const [searchQuery, setSearchQuery] = useState("");

    // Folder list filters
    const [folderTab, setFolderTab] = useState<"all" | "mine" | "sharedWithMe" | "sharedByMe">("all");
    const [folderSearch, setFolderSearch] = useState("");
    const [folderBatch, setFolderBatch] = useState("all");
    const [folderSort, setFolderSort] = useState<"newest" | "deadline" | "submissions">("newest");

    // Sharing states
    const [shareTarget, setShareTarget] = useState<HomeworkAssignment | null>(null);
    const [shareableTeachers, setShareableTeachers] = useState<ShareableTeacher[]>([]);
    const [shareSearch, setShareSearch] = useState("");
    const [shareSelected, setShareSelected] = useState<string[]>([]);
    const [existingShares, setExistingShares] = useState<{ sharedWithTeacherUid: string; sharedWithTeacherName: string }[]>([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareSaving, setShareSaving] = useState(false);
    const [unsharingUid, setUnsharingUid] = useState<string | null>(null);

    const isAdmin = userProfile?.role === "admin" || userProfile?.role === "super_admin";
    const isTeacher = userProfile?.role === "teacher";

    const fetchData = useCallback(async () => {
        if (!userProfile) return;
        setLoading(true);
        try {
            // Load batches for the dropdown
            const batches = await getPublicUniqueBatches();
            setAllBatches(batches);

            if (isAdmin) {
                 const batchData = await getAllBatchInfo();
                 // Auto-cleanup: check completed batches (Admin only)
                 const completedBatches: { batchName: string; completedAt: Date }[] = [];
                 const batchMap = new Map<string, { batchType?: string; createdAt?: Date }>();
                 batchData.forEach(s => {
                     if (!batchMap.has(s.batchName)) {
                         batchMap.set(s.batchName, { batchType: s.batchType, createdAt: s.createdAt ? new Date(s.createdAt) : undefined });
                     }
                 });
                 batchMap.forEach((info, batchName) => {
                     if (info.batchType === "Completed" && info.createdAt) {
                         completedBatches.push({ batchName, completedAt: info.createdAt });
                     }
                 });

                 if (completedBatches.length > 0) {
                     const res = await cleanupCompletedBatchHomework(completedBatches);
                     if (res.deleted > 0) setCleanupCount(res.deleted);
                 }
            }

            // Fetch assignments created by this teacher + ones shared with them (Admin acts as a teacher here too)
            let asgmts: HomeworkAssignment[] = [];
            if ((isTeacher || isAdmin) && userProfile.uid) {
                asgmts = await getHomeworkAssignmentsByTeacher(userProfile.uid);
                setAssignments(asgmts);
            }

            // Fetch homework submissions to this teacher
            let homeworkData: HomeworkSubmission[] = [];
            if ((isAdmin || isTeacher) && userProfile.displayName) {
                homeworkData = await getHomeworkByTeacher(userProfile.displayName);
            }
            // Plus submissions inside folders shared with me (they carry the owner's teacherName)
            if (userProfile.uid) {
                const sharedAsgmts = asgmts.filter(a => a.isSharedWithMe);
                if (sharedAsgmts.length > 0) {
                    const results = await Promise.all(sharedAsgmts.map(a => getSubmissionsByAssignment(a.id)));
                    const seen = new Set(homeworkData.map(h => h.id));
                    for (const list of results) {
                        for (const hw of list) {
                            if (!seen.has(hw.id)) {
                                seen.add(hw.id);
                                homeworkData.push(hw);
                            }
                        }
                    }
                }
            }
            setHomework(homeworkData);
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    }, [userProfile, isAdmin, isTeacher]);

    useEffect(() => {
        if (!authLoading && userProfile) {
            fetchData();
        }
    }, [authLoading, userProfile, fetchData]);

    // Reset search when switching folders
    useEffect(() => {
        setSearchQuery("");
    }, [selectedFolder]);


    // Handlers
    const handleCreateAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;
        setIsSubmittingAssignment(true);
        try {
            await createHomeworkAssignment({
                teacherUid: userProfile.uid!,
                teacherName: userProfile.displayName || "Unknown",
                title: assignmentTitle,
                batchName: assignmentBatch,
                deadlineDate: assignmentDeadline,
            });
            setIsCreatingAssignment(false);
            setAssignmentTitle("");
            setAssignmentBatch("all");
            setAssignmentDeadline("");
            fetchData(); // Reload assignments
        } catch (err) {
            console.error(err);
            alert("Failed to create assignment");
        } finally {
            setIsSubmittingAssignment(false);
        }
    };

    const confirmDeleteAssignment = async () => {
        if (!assignmentToDelete) return;
        setIsDeletingAssignment(true);
        try {
            // Find all submissions associated with this assignment
            const subs = homework.filter(h => h.assignmentId === assignmentToDelete.id || (!h.assignmentId && h.subject === assignmentToDelete.title));
            
            // Delete all corresponding homework files and documents
            for (const hw of subs) {
                const paths = hw.files ? hw.files.map(f => f.storagePath) : (hw.storagePath ? [hw.storagePath] : []);
                await deleteHomework(hw.id, paths);
            }
            
            // Delete the assignment folder
            await deleteHomeworkAssignment(assignmentToDelete.id);
            fetchData();
            setAssignmentToDelete(null);
            
            // If we are currently viewing this folder, return to folders view
            if (selectedFolder !== "other" && selectedFolder?.id === assignmentToDelete.id) {
                setSelectedFolder(null);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to delete assignment folder.");
        } finally {
            setIsDeletingAssignment(false);
        }
    };

    const handleDelete = async (hw: HomeworkSubmission) => {
        const ok = await confirm({ message: `Delete homework "${hw.subject}" by ${hw.studentName}?`, variant: "danger" });
        if (!ok) return;
        setDeletingId(hw.id);
        try {
            const paths = hw.files ? hw.files.map(f => f.storagePath) : (hw.storagePath ? [hw.storagePath] : []);
            await deleteHomework(hw.id, paths);
            setHomework(prev => prev.filter(h => h.id !== hw.id));
            if (viewingSubmission?.id === hw.id) setViewingSubmission(null);
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Failed to delete homework.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenEdit = (a: HomeworkAssignment) => {
        setAssignmentToEdit(a);
        setEditTitle(a.title);
        setEditBatch(a.batchName);
        setEditDeadline(a.deadlineDate);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignmentToEdit) return;
        setIsSavingEdit(true);
        try {
            await updateHomeworkAssignment(assignmentToEdit.id, {
                title: editTitle,
                batchName: editBatch,
                deadlineDate: editDeadline,
            });
            fetchData();
            setAssignmentToEdit(null);
        } catch (err) {
            console.error(err);
            alert("Failed to update assignment.");
        } finally {
            setIsSavingEdit(false);
        }
    };

    // ─── Sharing (owner only, view-only, no re-share) ───
    const handleOpenShare = async (a: HomeworkAssignment) => {
        setShareTarget(a);
        setShareSearch("");
        setShareSelected([]);
        setShareLoading(true);
        try {
            const [shares, teachers] = await Promise.all([
                getAssignmentShares(a.id),
                getShareableTeachers(userProfile?.uid),
            ]);
            setExistingShares(shares);
            setShareableTeachers(teachers);
        } catch (err) {
            console.error(err);
        } finally {
            setShareLoading(false);
        }
    };

    const handleSaveShare = async () => {
        if (!shareTarget || shareSelected.length === 0) return;
        setShareSaving(true);
        try {
            const teachers = shareSelected
                .map(uid => {
                    const t = shareableTeachers.find(x => x.teacherUid === uid);
                    return t ? { uid: t.teacherUid, name: t.teacherName } : null;
                })
                .filter((x): x is { uid: string; name: string } => x !== null);
            const updated = await shareAssignment(shareTarget.id, teachers);
            setExistingShares(updated);
            setShareSelected([]);
            fetchData(); // refresh sharedCount badges
        } catch (err) {
            console.error(err);
            alert("Failed to share assignment.");
        } finally {
            setShareSaving(false);
        }
    };

    const handleUnshare = async (teacherUid: string) => {
        if (!shareTarget) return;
        setUnsharingUid(teacherUid);
        try {
            await unshareAssignment(shareTarget.id, teacherUid);
            setExistingShares(prev => prev.filter(s => s.sharedWithTeacherUid !== teacherUid));
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to remove share.");
        } finally {
            setUnsharingUid(null);
        }
    };

    // Derived states categorizations
    const getSubmissionsForAssignment = (assignment: HomeworkAssignment) => {
        return homework.filter(h => h.assignmentId === assignment.id || (!h.assignmentId && h.subject === assignment.title));
    };

    const getOtherSubmissions = () => {
        return homework.filter(h => {
             // For each assignment, check if this matches
             const isMatched = assignments.some(a => a.id === h.assignmentId || (!h.assignmentId && a.title === h.subject));
             return !isMatched;
        });
    };

    // Folder list: tab + search + batch + sort
    const folderSearchTrimmed = folderSearch.trim().toLowerCase();
    const visibleAssignments = assignments
        .filter(a => {
            if (folderTab === "mine") return !a.isSharedWithMe;
            if (folderTab === "sharedWithMe") return !!a.isSharedWithMe;
            if (folderTab === "sharedByMe") return !a.isSharedWithMe && (a.sharedCount ?? 0) > 0;
            return true;
        })
        .filter(a => folderBatch === "all" || a.batchName === "all" || a.batchName === folderBatch)
        .filter(a =>
            !folderSearchTrimmed ||
            a.title.toLowerCase().includes(folderSearchTrimmed) ||
            a.teacherName.toLowerCase().includes(folderSearchTrimmed)
        )
        .sort((a, b) => {
            if (folderSort === "deadline") return a.deadlineDate.localeCompare(b.deadlineDate);
            if (folderSort === "submissions") return getSubmissionsForAssignment(b).length - getSubmissionsForAssignment(a).length;
            return b.createdAt.localeCompare(a.createdAt);
        });
    const sharedWithMeCount = assignments.filter(a => a.isSharedWithMe).length;
    const sharedByMeCount = assignments.filter(a => !a.isSharedWithMe && (a.sharedCount ?? 0) > 0).length;

    let folderSubmissionsList: HomeworkSubmission[] = [];
    if (selectedFolder === "other") {
        folderSubmissionsList = getOtherSubmissions();
    } else if (selectedFolder) {
        folderSubmissionsList = getSubmissionsForAssignment(selectedFolder);
    }

    const searchQueryTrimmed = searchQuery.trim().toLowerCase();
    const activeSubmissionsList = searchQueryTrimmed
        ? folderSubmissionsList.filter(hw =>
            hw.studentName?.toLowerCase().includes(searchQueryTrimmed) ||
            hw.studentRoll?.toLowerCase().includes(searchQueryTrimmed)
        )
        : folderSubmissionsList;

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]"></div>
                <span className="ml-3 text-gray-500">Loading your homework space...</span>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1f2937]">Homework Dashboard</h1>
                        <p className="text-[#6b7280] mt-1">
                            Your personal workspace ({userProfile?.displayName})
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {selectedFolder !== null && (
                         <button
                            onClick={() => setSelectedFolder(null)}
                            className="px-4 py-2.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            Back to Folders
                        </button>
                    )}
                     <button
                        onClick={() => setIsCreatingAssignment(true)}
                        className="px-5 py-2.5 bg-[#059669] text-white font-bold rounded-xl hover:bg-[#047857] transition-all flex items-center gap-2 shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Assignment
                    </button>
                    <div className="bg-white rounded-xl px-4 py-2.5 border border-gray-100 shadow-sm whitespace-nowrap hidden sm:block">
                        <span className="text-sm text-gray-500">Total All: </span>
                        <span className="text-lg font-bold text-[#059669]">{homework.length}</span>
                    </div>
                </div>
            </div>

            {/* Folder Selection View */}
            {selectedFolder === null ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        📁 Assignment Folders
                    </h2>

                    {/* Filter tabs */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {([
                            { key: "all", label: `All (${assignments.length})` },
                            { key: "mine", label: `আমার ফোল্ডার (${assignments.length - sharedWithMeCount})` },
                            { key: "sharedWithMe", label: `Shared With Me (${sharedWithMeCount})` },
                            { key: "sharedByMe", label: `আমি শেয়ার করেছি (${sharedByMeCount})` },
                        ] as const).map(t => (
                            <button
                                key={t.key}
                                onClick={() => setFolderTab(t.key)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${folderTab === t.key
                                    ? "bg-[#059669] text-white border-[#059669] shadow-sm"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Search + batch + sort */}
                    <div className="flex flex-col md:flex-row gap-3 mb-6">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={folderSearch}
                                onChange={(e) => setFolderSearch(e.target.value)}
                                placeholder="Search folders by title or owner..."
                                className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-[#059669] transition-colors"
                            />
                        </div>
                        <select
                            value={folderBatch}
                            onChange={(e) => setFolderBatch(e.target.value)}
                            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#059669]"
                        >
                            <option value="all">All Batches</option>
                            {allBatches.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                        <select
                            value={folderSort}
                            onChange={(e) => setFolderSort(e.target.value as typeof folderSort)}
                            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#059669]"
                        >
                            <option value="newest">Newest first</option>
                            <option value="deadline">Deadline closest</option>
                            <option value="submissions">Most submissions</option>
                        </select>
                    </div>
                    
                    {assignments.length === 0 && getOtherSubmissions().length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="text-5xl mb-3">📂</div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No Folders Found</h3>
                            <p className="text-gray-500 text-sm">Click "Create Assignment" to create a new folder.</p>
                        </div>
                    ) : visibleAssignments.length === 0 && getOtherSubmissions().length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="text-5xl mb-3">🔍</div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No Folders Match</h3>
                            <p className="text-gray-500 text-sm">Try a different tab, search term or batch filter.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {/* Render Active Assignment Folders */}
                            {visibleAssignments.map(a => {
                                const subs = getSubmissionsForAssignment(a);
                                const isShared = !!a.isSharedWithMe;
                                return (
                                    <div 
                                        key={a.id}
                                        className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col h-full overflow-hidden"
                                    >
                                        {/* Clickable body area — navigates into folder */}
                                        <div
                                            onClick={() => setSelectedFolder(a)}
                                            className="p-6 cursor-pointer hover:bg-emerald-50/40 transition-colors flex-1 flex flex-col"
                                        >
                                            {/* Folder Graphic */}
                                            <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform origin-left drop-shadow-sm">
                                                {subs.length > 0 ? "📂" : "📁"}
                                            </div>
                                            
                                            <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight flex-1">{a.title}</h3>

                                            {/* Ownership / sharing badge */}
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {isShared ? (
                                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                                        🤝 Shared by {a.teacherName}
                                                    </span>
                                                ) : (a.sharedCount ?? 0) > 0 ? (
                                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                                        📤 {a.sharedCount} teacher{(a.sharedCount ?? 0) > 1 ? "s" : ""} এর সাথে শেয়ারড
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                                        নিজের ফোল্ডার
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="mt-4 pt-4 border-t border-gray-50 text-xs flex flex-col gap-1.5">
                                                <div className="flex justify-between w-full">
                                                    <span className="text-gray-500">Batch:</span>
                                                    <span className="font-bold text-gray-700">{a.batchName === "all" ? "All Batches" : a.batchName}</span>
                                                </div>
                                                <div className="flex justify-between w-full">
                                                    <span className="text-gray-500">Deadline:</span>
                                                    <span className="font-bold text-red-600">{a.deadlineDate}</span>
                                                </div>
                                                <div className="flex justify-between w-full mt-1.5 pt-1.5 border-t border-gray-100/50">
                                                    <span className="text-gray-600 font-medium">Submissions:</span>
                                                    <span className="font-black text-emerald-600 text-sm bg-emerald-100 px-2 rounded-full">{subs.length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action bar — NOT inside the clickable area */}
                                        <div className="flex border-t border-gray-100 bg-gray-50/80 divide-x divide-gray-100">
                                            {isShared ? (
                                                <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-blue-500">
                                                    👁️ View only
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleOpenEdit(a)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenShare(a)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                                        Share{(a.sharedCount ?? 0) > 0 ? ` (${a.sharedCount})` : ""}
                                                    </button>
                                                    <button
                                                        onClick={() => setAssignmentToDelete(a)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Render Other Submissions Folder (if any) */}
                            {getOtherSubmissions().length > 0 && (
                                <div 
                                    onClick={() => setSelectedFolder("other")}
                                    className="bg-white hover:bg-gray-50/50 p-6 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 transition-all cursor-pointer group flex flex-col h-full opacity-90"
                                >
                                    <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform origin-left grayscale">
                                        📦
                                    </div>
                                    <h3 className="font-bold text-gray-800 flex-1">Other Submissions</h3>
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">Older homeworks not linked to current active assignments.</p>
                                    
                                    <div className="mt-4 pt-4 border-t border-gray-50 text-xs flex flex-col gap-1.5">
                                        <div className="flex justify-between w-full mt-1.5 pt-1.5">
                                            <span className="text-gray-600 font-medium">Submissions:</span>
                                            <span className="font-black text-gray-700 text-sm bg-gray-200 px-2 rounded-full">{getOtherSubmissions().length}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* Inside a Specific Folder View */
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    
                    {/* Folder Header Info */}
                    <div className="bg-gradient-to-br from-[#059669] to-[#047857] rounded-3xl p-6 md:p-8 text-white shadow-md mb-8 relative overflow-hidden">
                        {/* decorative background element */}
                         <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4">
                             <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor">
                                 <path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5 3c1.1 0 2 .89 2 2s-.9 2-2 2-2-.89-2-2 .9-2 2-2zm4 8h-8v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1z" />
                             </svg>
                         </div>
                         
                        <div className="relative z-10">
                            <h2 className="text-2xl md:text-3xl font-black mb-2 flex items-center gap-3">
                                <span className="text-4xl drop-shadow-sm">{selectedFolder === "other" ? "📦" : "📂"}</span> 
                                {selectedFolder === "other" ? "Other Submissions" : selectedFolder.title}
                            </h2>
                            {selectedFolder !== "other" && (
                                <div className="flex flex-wrap gap-4 mt-4 text-sm font-medium bg-white/10 inline-flex px-4 py-2 rounded-xl backdrop-blur-sm border border-emerald-400/30">
                                    <span>Target Batch: <strong className="text-emerald-100">{selectedFolder.batchName === "all" ? "All Batches" : selectedFolder.batchName}</strong></span>
                                    <span className="hidden sm:inline opacity-50">|</span>
                                    <span>Deadline: <strong className="text-emerald-100">{selectedFolder.deadlineDate}</strong></span>
                                </div>
                            )}
                            <div className="mt-4 flex items-center gap-2">
                                <span className="px-3 py-1 bg-white text-emerald-800 font-bold rounded-lg text-sm shadow-sm">
                                    {searchQueryTrimmed
                                        ? `${activeSubmissionsList.length} / ${folderSubmissionsList.length} Submissions`
                                        : `${folderSubmissionsList.length} Submissions`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Shared folder notice — view only */}
                    {selectedFolder !== "other" && (selectedFolder as HomeworkAssignment)?.isSharedWithMe && (
                        <div className="mb-6 px-5 py-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3 text-sm">
                            <span className="text-xl">🤝</span>
                            <p className="text-blue-800">
                                <strong>{(selectedFolder as HomeworkAssignment).teacherName}</strong>-এর শেয়ার করা ফোল্ডার — আপনি শুধু দেখতে পারবেন (View only)। Edit / Delete / Share শুধু owner করতে পারবেন।
                            </p>
                        </div>
                    )}

                    {/* Search Bar */}
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by student name or roll number..."
                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-[#059669] transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Submissions List */}
                    {activeSubmissionsList.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center mt-6">
                            <div className="text-5xl mb-3">{searchQueryTrimmed ? "🔍" : "✨"}</div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                                {searchQueryTrimmed ? "No Matching Submissions" : "Folder is Empty"}
                            </h3>
                            <p className="text-gray-500 text-sm">
                                {searchQueryTrimmed
                                    ? `No student matches "${searchQuery}" in this folder.`
                                    : "No submissions found in this folder."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            {activeSubmissionsList.map((hw) => (
                                <div
                                    key={hw.id}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col md:flex-row"
                                >
                                    {/* Student Card Block */}
                                    <div className="p-5 md:w-2/5 shrink-0 border-b md:border-b-0 md:border-r border-gray-50 bg-gray-50/50 flex flex-col justify-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xl shrink-0 shadow-inner">
                                                {hw.studentName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 text-base leading-tight truncate">{hw.studentName}</p>
                                                <p className="text-xs text-gray-600 mt-1 font-medium bg-gray-200 inline-block px-2 py-0.5 rounded-full">
                                                    Roll: {hw.studentRoll}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                                                    {hw.studentBatchName}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Block */}
                                    <div className="p-5 flex-1 flex flex-col min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <p className="text-xs text-gray-400 font-medium">Submitted: {hw.submissionDate}</p>
                                        </div>

                                        {/* File attachments (multi-file support) */}
                                        {(() => {
                                            const filesToShow: UploadedFile[] = hw.files && hw.files.length > 0
                                                ? hw.files
                                                : hw.fileName
                                                    ? [{ fileName: hw.fileName, url: hw.fileUrl ?? "", storagePath: hw.storagePath ?? "", size: 0 }]
                                                    : [];
                                            return filesToShow.length > 0 ? (
                                                <div className="mb-3 space-y-1.5 min-w-0">
                                                    {filesToShow.map((f, i) => (
                                                        <a
                                                            key={i}
                                                            href={f.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 px-3 py-2 bg-blue-50/80 border border-blue-100 rounded-lg text-sm text-blue-800 hover:bg-blue-100 transition-colors group/link w-full min-w-0"
                                                        >
                                                            <svg className="w-4 h-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                            </svg>
                                                            <span className="truncate font-semibold group-hover/link:underline flex-1 min-w-0">{f.fileName}</span>
                                                            {f.size! > 0 && (
                                                                <span className="text-xs text-blue-400 shrink-0">({(f.size!/1024/1024).toFixed(1)}MB)</span>
                                                            )}
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}


                                        {/* Text preview — URLs become clickable links */}
                                        {hw.textContent && (
                                            <div className="text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 mb-3 italic line-clamp-3">
                                                {/https?:\/\/\S+/i.test(hw.textContent) ? (
                                                    <a
                                                        href={hw.textContent.trim()}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline break-all not-italic font-medium"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        🔗 {hw.textContent.trim()}
                                                    </a>
                                                ) : (
                                                    <span>&quot;{hw.textContent}&quot;</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Spacer to push buttons down */}
                                        <div className="flex-1"></div>

                                        <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-4 mt-auto shrink-0">
                                            {!(selectedFolder !== "other" && (selectedFolder as HomeworkAssignment)?.isSharedWithMe) && (
                                                <button
                                                    onClick={() => handleDelete(hw)}
                                                    disabled={deletingId === hw.id}
                                                    className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline transition-colors disabled:opacity-50"
                                                >
                                                    {deletingId === hw.id ? "Deleting..." : "Delete"}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setViewingSubmission(hw)}
                                                className="text-sm font-bold text-white bg-[#059669] hover:bg-[#047857] px-4 py-1.5 rounded-lg transition-colors shadow-sm whitespace-nowrap"
                                            >
                                                View Details  ↗
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {viewingSubmission && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setViewingSubmission(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-[#059669] to-[#10b981] p-6 text-white">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xl font-bold truncate">{viewingSubmission.subject}</h3>
                                    <p className="text-emerald-100 text-sm mt-1">Submitted {viewingSubmission.submissionDate}</p>
                                </div>
                                <button
                                    onClick={() => setViewingSubmission(null)}
                                    className="text-white/80 hover:text-white text-3xl leading-none ml-3"
                                >✕</button>
                            </div>

                            <div className="mt-4 bg-white/20 rounded-xl px-5 py-3 text-sm space-y-1 backdrop-blur-sm">
                                <p><span className="opacity-75">Student:</span> <strong className="text-lg ml-1">{viewingSubmission.studentName}</strong></p>
                                <p>
                                    <span className="opacity-75">Roll:</span> <strong className="ml-1">{viewingSubmission.studentRoll}</strong>
                                    <span className="mx-2 opacity-50">|</span>
                                    <span className="opacity-75">Batch:</span> <strong className="ml-1">{viewingSubmission.studentBatchName}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="p-6 space-y-5 max-h-[500px] overflow-y-auto">
                            {(() => {
                                const filesToShow: UploadedFile[] = viewingSubmission.files && viewingSubmission.files.length > 0
                                    ? viewingSubmission.files
                                    : viewingSubmission.fileName
                                        ? [{ fileName: viewingSubmission.fileName, url: viewingSubmission.fileUrl ?? "", storagePath: viewingSubmission.storagePath ?? "", size: 0 }]
                                        : [];
                                return filesToShow.length > 0 ? (
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                                            Attached Files ({filesToShow.length})
                                        </label>
                                        <div className="space-y-2">
                                            {filesToShow.map((f, i) => (
                                                <a
                                                    key={i}
                                                    href={f.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 px-5 py-3 bg-blue-50/50 rounded-xl text-sm text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm"
                                                >
                                                    <svg className="w-5 h-5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                    </svg>
                                                    <span className="font-bold truncate flex-1">{f.fileName}</span>
                                                    {f.size! > 0 && (
                                                        <span className="text-xs text-blue-400">{(f.size!/1024/1024).toFixed(1)}MB</span>
                                                    )}
                                                    <span className="text-xs text-white bg-blue-500 px-3 py-1 rounded-full font-bold whitespace-nowrap shadow-sm">Download</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                ) : null;
                            })()}


                            {viewingSubmission.textContent && (
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Written Content</label>
                                    <div className="bg-gray-50/80 rounded-xl px-5 py-4 text-sm text-gray-800 border border-gray-200 whitespace-pre-wrap leading-relaxed shadow-inner font-medium">
                                        {/https?:\/\/\S+/i.test(viewingSubmission.textContent) ? (
                                            <a
                                                href={viewingSubmission.textContent.trim()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline break-all font-semibold flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                {viewingSubmission.textContent.trim()}
                                            </a>
                                        ) : (
                                            viewingSubmission.textContent
                                        )}
                                    </div>
                                </div>
                            )}

                            {!(viewingSubmission.files?.length) && !viewingSubmission.fileName && !viewingSubmission.textContent && (
                                <p className="text-gray-400 text-sm text-center py-4 italic">No content or attachment found.</p>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50">
                             <button
                                onClick={() => setViewingSubmission(null)}
                                className="px-6 py-2 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Assignment Confirmation Modal */}
            {assignmentToDelete && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isDeletingAssignment && setAssignmentToDelete(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 scale-100 hover:scale-110 transition-transform">
                                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2">Delete Folder?</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Are you sure you want to delete the folder <strong className="text-gray-800">"{assignmentToDelete.title}"</strong>?
                            </p>
                            <p className="text-xs text-red-500 font-bold bg-red-50 py-3 px-3 rounded-lg border border-red-100">
                                This will also permanently delete all homework submissions inside this folder.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-gray-100">
                            <button
                                onClick={() => setAssignmentToDelete(null)}
                                disabled={isDeletingAssignment}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-all w-full shadow-sm"
                            >
                                No, Cancel
                            </button>
                            <button
                                onClick={confirmDeleteAssignment}
                                disabled={isDeletingAssignment}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all w-full shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isDeletingAssignment ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Deleting...
                                    </>
                                ) : "Yes, Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Assignment Modal */}
            {assignmentToEdit && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isSavingEdit && setAssignmentToEdit(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-5 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                <h3 className="no-gradient text-lg font-bold text-white">Edit Assignment Folder</h3>
                            </div>
                            <button
                                onClick={() => setAssignmentToEdit(null)}
                                disabled={isSavingEdit}
                                className="text-white/80 hover:text-white text-2xl leading-none"
                            >✕</button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Assignment Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Target Batch <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={editBatch}
                                    onChange={e => setEditBatch(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                                >
                                    <option value="all">🌐 All Batches</option>
                                    {allBatches.map(b => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Deadline Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    required
                                    value={editDeadline}
                                    onChange={e => setEditDeadline(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAssignmentToEdit(null)}
                                    disabled={isSavingEdit}
                                    className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit || !editTitle || !editDeadline}
                                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSavingEdit ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Share Assignment Modal (owner only) */}
            {shareTarget && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => !shareSaving && setShareTarget(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 p-5 text-white flex justify-between items-center">
                            <div className="min-w-0">
                                <h3 className="no-gradient text-lg font-bold text-white">Share Folder 🤝</h3>
                                <p className="text-blue-100 text-xs mt-0.5 truncate">“{shareTarget.title}” — selected teachers can view only</p>
                            </div>
                            <button
                                onClick={() => setShareTarget(null)}
                                disabled={shareSaving}
                                className="text-white/80 hover:text-white text-2xl leading-none ml-3 shrink-0"
                            >✕</button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                            {shareLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Already shared with */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                                            Shared with ({existingShares.length})
                                        </label>
                                        {existingShares.length === 0 ? (
                                            <p className="text-sm text-gray-400 italic">এখনো কারো সাথে শেয়ার করা হয়নি।</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {existingShares.map(s => (
                                                    <div key={s.sharedWithTeacherUid} className="flex items-center gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black shrink-0">
                                                            {s.sharedWithTeacherName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{s.sharedWithTeacherName}</span>
                                                        <button
                                                            onClick={() => handleUnshare(s.sharedWithTeacherUid)}
                                                            disabled={unsharingUid === s.sharedWithTeacherUid}
                                                            className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0"
                                                        >
                                                            {unsharingUid === s.sharedWithTeacherUid ? "Removing..." : "Remove"}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Add more teachers */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                                            Share with more teachers
                                        </label>
                                        <input
                                            type="text"
                                            value={shareSearch}
                                            onChange={(e) => setShareSearch(e.target.value)}
                                            placeholder="Search teacher by name..."
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mb-2"
                                        />
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                                            {shareableTeachers
                                                .filter(t =>
                                                    !existingShares.some(s => s.sharedWithTeacherUid === t.teacherUid) &&
                                                    (!shareSearch.trim() || t.teacherName.toLowerCase().includes(shareSearch.trim().toLowerCase()))
                                                )
                                                .map(t => (
                                                    <label key={t.teacherUid} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={shareSelected.includes(t.teacherUid)}
                                                            onChange={(e) => setShareSelected(prev =>
                                                                e.target.checked
                                                                    ? [...prev, t.teacherUid]
                                                                    : prev.filter(uid => uid !== t.teacherUid)
                                                            )}
                                                            className="w-4 h-4 accent-blue-600"
                                                        />
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-black text-sm shrink-0">
                                                            {t.teacherName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-gray-800 truncate">{t.teacherName}</p>
                                                            {t.designation && <p className="text-xs text-gray-400 truncate">{t.designation}</p>}
                                                        </div>
                                                    </label>
                                                ))}
                                            {shareableTeachers.filter(t =>
                                                !existingShares.some(s => s.sharedWithTeacherUid === t.teacherUid) &&
                                                (!shareSearch.trim() || t.teacherName.toLowerCase().includes(shareSearch.trim().toLowerCase()))
                                            ).length === 0 && (
                                                <p className="text-sm text-gray-400 italic text-center py-3">No more teachers found.</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                            <button
                                onClick={() => setShareTarget(null)}
                                disabled={shareSaving}
                                className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleSaveShare}
                                disabled={shareSaving || shareLoading || shareSelected.length === 0}
                                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {shareSaving ? "Sharing..." : `Share${shareSelected.length > 0 ? ` (${shareSelected.length})` : ""}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Assignment Modal */}
            {isCreatingAssignment && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isSubmittingAssignment && setIsCreatingAssignment(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-[#059669] to-[#10b981] p-5 text-white flex justify-between items-center">
                            <h3 className="no-gradient text-lg font-bold text-white">Create New Assignment</h3>
                            <button
                                onClick={() => setIsCreatingAssignment(false)}
                                disabled={isSubmittingAssignment}
                                className="text-white/80 hover:text-white text-2xl leading-none"
                            >✕</button>
                        </div>
                        <form onSubmit={handleCreateAssignment} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Assignment Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={assignmentTitle}
                                    onChange={e => setAssignmentTitle(e.target.value)}
                                    placeholder="e.g. Week 4 - React Basics"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#059669] focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Target Batch <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={assignmentBatch}
                                    onChange={e => setAssignmentBatch(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#059669] focus:outline-none bg-white"
                                >
                                    <option value="all">🌐 All Batches</option>
                                    {allBatches.map(b => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Deadline Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    required
                                    value={assignmentDeadline}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={e => setAssignmentDeadline(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#059669] focus:outline-none"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreatingAssignment(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAssignment || !assignmentTitle || !assignmentDeadline}
                                    className="px-5 py-2 bg-[#059669] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-[#047857] disabled:opacity-50"
                                >
                                    {isSubmittingAssignment ? "Creating..." : "Create Assignment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
