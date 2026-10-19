"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    uploadMultipleHomeworkFiles,
    submitHomework,
    getHomeworkByStudent,
    formatHomeworkDate,
    HomeworkSubmission,
    UploadedFile,
    getActiveHomeworkAssignmentsForStudent,
    HomeworkAssignment
} from "@/services/homeworkService";
import { formatDeadline } from "@/lib/homeworkDeadline";

export default function HomeworkSubmissionPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const [isClient, setIsClient] = useState(false);

    // Set isClient to true once mounted
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Assignments & Teachers
    const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
    const [uniqueTeachers, setUniqueTeachers] = useState<string[]>([]);
    const [loadingAssignments, setLoadingAssignments] = useState(true);

    // Form state
    const [selectedTeacher, setSelectedTeacher] = useState("");
    const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
    const [subject, setSubject] = useState("");

    const [textContent, setTextContent] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // History
    const [mySubmissions, setMySubmissions] = useState<HomeworkSubmission[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const MAX_TOTAL_SIZE_MB = 50;
    const MAX_TOTAL_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

    // Calculate total size of selected files
    const totalSelectedSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    const totalSizeMB = (totalSelectedSize / 1024 / 1024).toFixed(2);
    const isOverLimit = totalSelectedSize > MAX_TOTAL_BYTES;

    useEffect(() => {
        const fetchAssignments = async () => {
             if (userProfile?.studentBatchName) {
                 try {
                     const data = await getActiveHomeworkAssignmentsForStudent(userProfile.studentBatchName);
                     setAssignments(data);

                     // Extract unique teachers from active assignments
                     const teachers = Array.from(new Set(data.map(a => a.teacherName))).sort();
                     setUniqueTeachers(teachers);
                 } catch (err) {
                     console.error("Failed to load assignments:", err);
                 } finally {
                     setLoadingAssignments(false);
                 }
             } else if (!authLoading) {
                 setLoadingAssignments(false);
             }
        };

        if (isClient && !authLoading && user && userProfile) {
            fetchAssignments();
        }
    }, [user, userProfile, authLoading, isClient]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (userProfile?.uid) {
                try {
                    const data = await getHomeworkByStudent(userProfile.uid);
                    setMySubmissions(data);
                } catch (err) {
                    console.error("Failed to load submissions:", err);
                } finally {
                    setLoadingHistory(false);
                }
            }
        };
        if (isClient && !authLoading && user && userProfile) {
            fetchHistory();
        }
    }, [user, userProfile, authLoading, isClient]);

    // When teacher changes, reset assignment selection
    useEffect(() => {
        setSelectedAssignmentId("");
    }, [selectedTeacher]);

    // When assignment is selected, update subject
    useEffect(() => {
        if (selectedAssignmentId) {
            const assignment = assignments.find(a => a.id === selectedAssignmentId);
            if (assignment) {
                setSubject(assignment.title);
            }
        } else {
            setSubject("");
        }
    }, [selectedAssignmentId, assignments]);

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        const fileArray = Array.from(newFiles);
        setSubmitError("");

        setSelectedFiles(prev => {
            const existing = [...prev];
            const existingNames = new Set(existing.map(f => f.name));

            for (const file of fileArray) {
                if (existingNames.has(file.name)) continue; // skip duplicates
                existing.push(file);
            }

            const newTotal = existing.reduce((acc, f) => acc + f.size, 0);
            if (newTotal > MAX_TOTAL_BYTES) {
                setSubmitError(`মোট ফাইল সাইজ ${MAX_TOTAL_SIZE_MB}MB এর বেশি হতে পারবে না।`);
            }

            return existing;
        });
    }, [MAX_TOTAL_BYTES]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(e.target.files);
        }
        // Reset input so same files can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setSubmitError("");
    };

    // Drag and Drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            addFiles(e.dataTransfer.files);
        }
    };

    const resetForm = () => {
        setSelectedTeacher("");
        setSelectedAssignmentId("");
        setSubject("");
        setTextContent("");
        setSelectedFiles([]);
        setUploadProgress(0);
        setSubmitError("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTeacher) {
            setSubmitError("Please select a teacher.");
            return;
        }
        if (!selectedAssignmentId) {
            setSubmitError("Please select an assignment.");
            return;
        }
        if (selectedFiles.length === 0 && !textContent.trim()) {
            setSubmitError("Please upload a file or write your homework text.");
            return;
        }
        if (isOverLimit) {
            setSubmitError(`মোট ফাইল সাইজ ${MAX_TOTAL_SIZE_MB}MB এর বেশি হতে পারবে না।`);
            return;
        }
        const uid = userProfile?.uid;
        if (!uid) return;

        setIsSubmitting(true);
        setSubmitError("");
        setUploadProgress(0);

        try {
            let uploadedFiles: UploadedFile[] = [];

            // Upload all files if present
            if (selectedFiles.length > 0) {
                try {
                    uploadedFiles = await uploadMultipleHomeworkFiles(
                        selectedFiles,
                        (idx, progress) => setUploadProgress(progress)
                    );
                } catch (uploadErr) {
                    const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                    // Handle common upload errors with Bangla messages
                    if (msg.includes("401") || msg.includes("Unauthorized")) {
                        setSubmitError("Session expired. Please log out and log in again.");
                    } else if (msg.includes("403") || msg.includes("Forbidden")) {
                        setSubmitError("Upload permission denied. Please refresh and try again.");
                    } else if (msg.includes("413") || msg.includes("too large")) {
                        setSubmitError(`ফাইল সাইজ বেশি বড়। ${MAX_TOTAL_SIZE_MB}MB-এর মধ্যে রাখুন।`);
                    } else {
                        setSubmitError(`File upload failed: ${msg}`);
                    }
                    return;
                }
            }

            const now = new Date();
            const firstFile = uploadedFiles[0];

            await submitHomework({
                studentUid: uid,
                studentName: userProfile.displayName || "Unknown",
                studentRoll: userProfile.studentRoll || "N/A",
                studentBatchName: userProfile.studentBatchName || "N/A",
                teacherName: selectedTeacher,
                subject: subject,
                assignmentId: selectedAssignmentId,
                fileUrl: firstFile?.url,
                storagePath: firstFile?.storagePath,
                fileName: firstFile?.fileName,
                files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
                textContent: textContent.trim() || undefined,
                submissionDate: formatHomeworkDate(now),
            });

            setSubmitSuccess(true);
            resetForm();

            const updated = await getHomeworkByStudent(uid);
            setMySubmissions(updated);

            setTimeout(() => setSubmitSuccess(false), 4000);
        } catch (err) {
            console.error("Homework submission error:", err);
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("401") || msg.includes("Unauthorized")) {
                setSubmitError("Session expired. Please log out and log in again.");
            } else if (msg.includes("500") || msg.includes("Internal")) {
                setSubmitError("Server error. Please try again in a moment.");
            } else {
                setSubmitError(`Failed to submit: ${msg}`);
            }
        } finally {
            setIsSubmitting(false);
            setUploadProgress(0);
        }
    };

    const filteredAssignments = assignments.filter(a => a.teacherName === selectedTeacher);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-5 sm:space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#1f2937]">Homework Submission</h1>
                    <p className="text-[#6b7280] mt-1">Submit your assignments here</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-8">
                {/* ===== LEFT: Submission Form ===== */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Form Header with auto-filled student info */}
                        <div className="bg-gradient-to-r from-[#059669] to-[#10b981] p-4 sm:p-5 text-white">
                            <h2 className="text-xl font-bold no-gradient text-white">Submit Homework</h2>
                            <p className="text-emerald-100 text-sm mt-0.5 no-gradient">আপনার হোমওয়ার্ক সাবমিট করুন</p>
                            <div className="mt-3 bg-white/20 rounded-xl px-4 py-2.5 text-sm space-y-0.5">
                                <p><span className="opacity-75">Name:</span> <strong>{userProfile?.displayName}</strong></p>
                                <p>
                                    <span className="opacity-75">Batch:</span> <strong>{userProfile?.studentBatchName || "N/A"}</strong>
                                    &nbsp;|&nbsp;
                                    <span className="opacity-75">Roll:</span> <strong>{userProfile?.studentRoll || "N/A"}</strong>
                                    &nbsp;|&nbsp;
                                    <span className="opacity-75">Date:</span> <strong>{formatHomeworkDate(new Date())}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Success State */}
                        {submitSuccess && (
                            <div className="mx-4 mt-4 sm:mx-6 sm:mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                                <span className="text-2xl">✅</span>
                                <div>
                                    <p className="font-bold text-emerald-800 text-sm">Homework Submitted Successfully!</p>
                                    <p className="text-emerald-600 text-xs">Your teacher will review it soon.</p>
                                </div>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
                            {/* Teacher Select */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Select Teacher / টিচার সিলেক্ট করুন <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedTeacher}
                                    onChange={(e) => setSelectedTeacher(e.target.value)}
                                    required
                                    disabled={loadingAssignments || uniqueTeachers.length === 0}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#059669] focus:border-[#059669] outline-none transition-all bg-white disabled:opacity-50 disabled:bg-gray-50"
                                >
                                    <option value="">
                                        {loadingAssignments
                                            ? "Loading teachers..."
                                            : uniqueTeachers.length === 0
                                                ? "No teachers have posted assignments for your batch."
                                                : "-- Select a Teacher --"}
                                    </option>
                                    {uniqueTeachers.map((tName) => (
                                        <option key={tName} value={tName}>{tName}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Assignment Select (Only visible if teacher is selected) */}
                            {selectedTeacher && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Select Assignment / অ্যাসাইনমেন্ট <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedAssignmentId}
                                        onChange={(e) => setSelectedAssignmentId(e.target.value)}
                                        required
                                        className="w-full px-4 py-2.5 border border-emerald-300 rounded-xl text-sm focus:ring-2 focus:ring-[#059669] focus:border-[#059669] outline-none transition-all bg-emerald-50"
                                    >
                                        <option value="">-- Select open assignment --</option>
                                        {filteredAssignments.map((assignment) => (
                                            <option key={assignment.id} value={assignment.id}>
                                                {assignment.title} (Due {formatDeadline(assignment.deadlineDate, assignment.deadlineTime)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="relative pt-2">
                                <div className="absolute inset-0 flex items-center pt-2"><div className="w-full border-t border-gray-200"></div></div>
                                <div className="relative flex justify-center text-sm pt-2">
                                    <span className="bg-white px-3 text-gray-400 font-medium">Homework Content</span>
                                </div>
                            </div>

                            {/* ===== Multi-File Upload Area ===== */}
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1.5">
                                    <label className="block text-sm font-semibold text-gray-700">
                                        Upload Files{" "}
                                        <span className="text-gray-400 font-normal">(Optional — Max {MAX_TOTAL_SIZE_MB}MB total)</span>
                                    </label>
                                    {selectedFiles.length > 0 && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                                            isOverLimit
                                                ? "bg-red-100 text-red-600"
                                                : "bg-emerald-100 text-emerald-700"
                                        }`}>
                                            {totalSizeMB} / {MAX_TOTAL_SIZE_MB} MB
                                        </span>
                                    )}
                                </div>

                                {/* Drop Zone */}
                                <div
                                    ref={dropZoneRef}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
                                        isDragging
                                            ? "border-[#059669] bg-emerald-50 scale-[1.01]"
                                            : isOverLimit
                                                ? "border-red-300 bg-red-50"
                                                : "border-gray-300 bg-gray-50/60 hover:border-[#059669] hover:bg-emerald-50/40"
                                    }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        multiple
                                        accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.html,.htm,.zip,.csv,.txt"
                                        className="hidden"
                                    />
                                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                            isDragging ? "bg-emerald-100" : "bg-gray-200"
                                        }`}>
                                            <svg className={`w-5 h-5 ${isDragging ? "text-emerald-600" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-700">
                                                {isDragging ? "ছেড়ে দিন!" : "ফাইল drag করুন অথবা ক্লিক করুন"}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                একাধিক ফাইল সিলেক্ট করা যাবে · সর্বোচ্চ {MAX_TOTAL_SIZE_MB}MB
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                ছবি, PDF, Word, Excel, PowerPoint, HTML, SVG, ZIP
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Selected Files List */}
                                {selectedFiles.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {selectedFiles.map((file, index) => (
                                            <div
                                                key={`${file.name}-${index}`}
                                                className="flex items-center gap-2.5 text-xs bg-white border border-gray-200 px-3 py-2 rounded-lg group hover:border-emerald-300 transition-colors"
                                            >
                                                <svg className="w-4 h-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                                <span className="font-medium text-gray-700 flex-1 min-w-0 truncate">{file.name}</span>
                                                <span className="text-gray-400 shrink-0">
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(index)}
                                                    disabled={isSubmitting}
                                                    className="shrink-0 text-gray-400 hover:text-red-500 transition-colors p-2 -m-1.5 rounded disabled:opacity-50"
                                                    title="Remove file"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}

                                        {/* Over limit warning */}
                                        {isOverLimit && (
                                            <p className="text-xs text-red-600 font-medium flex items-center gap-1.5 px-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                মোট সাইজ {MAX_TOTAL_SIZE_MB}MB সীমা ছাড়িয়ে গেছে। কিছু ফাইল সরান।
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Upload Progress Bar */}
                                {isSubmitting && selectedFiles.length > 0 && uploadProgress > 0 && (
                                    <div className="mt-3">
                                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                            <span>Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}...</span>
                                            <span className="font-bold text-emerald-600">{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-[#059669] h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Text Content */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Write Homework <span className="text-gray-400 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    value={textContent}
                                    onChange={(e) => setTextContent(e.target.value)}
                                    placeholder="আপনার হোমওয়ার্ক এখানে লিখুন..."
                                    rows={5}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#059669] focus:border-[#059669] outline-none transition-all resize-none"
                                />
                            </div>

                            {/* Error */}
                            {submitError && (
                                <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100 flex items-center gap-2">
                                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    {submitError}
                                </p>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedAssignmentId || !selectedTeacher || isOverLimit}
                                className="w-full py-3 min-h-12 bg-[#059669] text-white font-bold rounded-xl hover:bg-[#047857] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-sm"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        {selectedFiles.length > 0 ? `Uploading... ${uploadProgress}%` : "Submitting..."}
                                    </span>
                                ) : (
                                    "Submit Homework"
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* ===== RIGHT: Submission History ===== */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                📋 My Submissions
                                {mySubmissions.length > 0 && (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                                        {mySubmissions.length}
                                    </span>
                                )}
                            </h3>
                        </div>

                        <div className="p-4 space-y-3 lg:max-h-[600px] lg:overflow-y-auto">
                            {loadingHistory ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#059669]"></div>
                                </div>
                            ) : mySubmissions.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-2">📭</div>
                                    <p className="text-gray-500 text-sm">No homework submitted yet.</p>
                                    <p className="text-gray-400 text-xs mt-1">Your submissions will appear here.</p>
                                </div>
                            ) : (
                                mySubmissions.map((hw) => {
                                    // Determine files to show: prefer new files[] array, fallback to legacy single file
                                    const filesToShow = hw.files && hw.files.length > 0
                                        ? hw.files
                                        : hw.fileName
                                            ? [{ fileName: hw.fileName, url: hw.fileUrl ?? "", storagePath: hw.storagePath ?? "", size: 0 }]
                                            : [];

                                    return (
                                        <div
                                            key={hw.id}
                                            className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-900 text-sm truncate">{hw.subject}</h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        <span className="font-medium text-emerald-700">To:</span> {hw.teacherName}
                                                    </p>
                                                </div>
                                                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{hw.submissionDate}</span>
                                            </div>

                                            {/* Files */}
                                            {filesToShow.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {filesToShow.map((f, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 text-xs">
                                                                            <a
                                                                href={f.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:underline truncate"
                                                            >
                                                                {f.fileName}
                                                            </a>
                                                            {f.size && f.size > 0 && (
                                                                <span className="text-gray-400 shrink-0">
                                                                    ({(f.size / 1024 / 1024).toFixed(1)}MB)
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {hw.textContent && (
                                                <p className="mt-2 text-xs text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-100 line-clamp-3">
                                                    {hw.textContent}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
