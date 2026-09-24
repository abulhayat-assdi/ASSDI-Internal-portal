// ============================================================
// homeworkService — All Firebase calls replaced with API calls
// ============================================================

export interface HomeworkFile {
    url: string;
    storagePath: string;
    fileName: string;
    size?: number;
}

export type UploadedFile = HomeworkFile;


export interface HomeworkSubmission {
    id: string;
    studentUid: string;
    studentName: string;
    studentRoll: string;
    studentBatchName: string;
    teacherName: string;
    subject: string;
    files?: HomeworkFile[];
    fileUrl?: string;
    storagePath?: string;
    fileName?: string;
    textContent?: string;
    submissionDate: string;
    assignmentId?: string;
    submittedAt: string;
}

export interface HomeworkAssignment {
    id: string;
    teacherUid: string;
    teacherName: string;
    title: string;
    deadlineDate: string;
    batchName: string;
    createdAt: string;
    /** true when this folder is shared with the viewer (not owned by them) */
    isSharedWithMe?: boolean;
    /** number of teachers this folder is shared with (owner view) */
    sharedCount?: number;
    sharedWith?: HomeworkAssignmentShare[];
}

export interface HomeworkAssignmentShare {
    id: string;
    assignmentId: string;
    sharedWithTeacherUid: string;
    sharedWithTeacherName: string;
    sharedByUid: string;
    createdAt: string;
}

export interface ShareableTeacher {
    teacherUid: string;
    teacherName: string;
    designation?: string;
    profileImageUrl?: string | null;
}

// ─── Assignments ───────────────────────────────────────────

export const getAssignmentsByTeacher = async (teacherUid: string): Promise<HomeworkAssignment[]> => {
    const res = await fetch(`/api/homework/assignments?teacherUid=${encodeURIComponent(teacherUid)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const getAssignmentsByBatch = async (batchName: string): Promise<HomeworkAssignment[]> => {
    const res = await fetch(`/api/homework/assignments?batchName=${encodeURIComponent(batchName)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const addAssignment = async (assignment: Omit<HomeworkAssignment, "id" | "createdAt">): Promise<string> => {
    const res = await fetch("/api/homework/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignment),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add assignment.");
    return data.id;
};

export const deleteAssignment = async (id: string): Promise<void> => {
    const res = await fetch(`/api/homework/assignments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete assignment.");
};

// ─── Sharing (view-only, owner-managed) ───────────────────────

export const getAssignmentShares = async (assignmentId: string): Promise<HomeworkAssignmentShare[]> => {
    const res = await fetch(`/api/homework/assignments/share?assignmentId=${encodeURIComponent(assignmentId)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const shareAssignment = async (assignmentId: string, teachers: { uid: string; name: string }[]): Promise<HomeworkAssignmentShare[]> => {
    const res = await fetch("/api/homework/assignments/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, teachers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to share assignment.");
    return data;
};

export const unshareAssignment = async (assignmentId: string, teacherUid: string): Promise<void> => {
    const res = await fetch(
        `/api/homework/assignments/share?assignmentId=${encodeURIComponent(assignmentId)}&teacherUid=${encodeURIComponent(teacherUid)}`,
        { method: "DELETE" }
    );
    if (!res.ok) throw new Error("Failed to remove share.");
};

/** Teachers in this course who can be shared with (excludesUid = the owner) */
export const getShareableTeachers = async (excludeUid?: string): Promise<ShareableTeacher[]> => {
    const res = await fetch("/api/resources/teachers", { cache: "no-store" });
    if (!res.ok) return [];
    const data: ShareableTeacher[] = await res.json();
    return excludeUid ? data.filter((t) => t.teacherUid !== excludeUid) : data;
};

export const getSubmissionsByAssignment = async (assignmentId: string): Promise<HomeworkSubmission[]> => {
    const res = await fetch(`/api/homework?assignmentId=${encodeURIComponent(assignmentId)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

// ─── Submissions ───────────────────────────────────────────

export const getSubmissionsByTeacher = async (teacherName: string): Promise<HomeworkSubmission[]> => {
    const res = await fetch(`/api/homework?teacherName=${encodeURIComponent(teacherName)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const getSubmissionsByStudent = async (studentUid: string): Promise<HomeworkSubmission[]> => {
    const res = await fetch(`/api/homework?studentUid=${encodeURIComponent(studentUid)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const getSubmissionsByBatch = async (batchName: string): Promise<HomeworkSubmission[]> => {
    const res = await fetch(`/api/homework?batchName=${encodeURIComponent(batchName)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const getAllSubmissions = async (): Promise<HomeworkSubmission[]> => {
    const res = await fetch("/api/homework?all=true", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const submitHomework = async (data: Omit<HomeworkSubmission, "id" | "submittedAt">): Promise<string> => {
    const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to submit homework.");
    return result.id;
};

export const deleteSubmission = async (id: string, filePaths: string[]): Promise<void> => {
    const res = await fetch("/api/homework", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, filePaths }),
    });
    if (!res.ok) throw new Error("Failed to delete submission.");
};

// ─── File Upload ────────────────────────────────────────────

/**
 * Upload a homework file via the storage API.
 * Uses XHR so we can track progress.
 * The session cookie is sent automatically (same-origin).
 */
export const uploadHomeworkFile = (
    file: File,
    onProgress?: (progress: number) => void
): Promise<HomeworkFile> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "homework");

        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve({ 
                        url: response.fileUrl, 
                        storagePath: response.storagePath, 
                        fileName: file.name, 
                        size: file.size 
                    });
                } catch {
                    reject(new Error("Failed to parse upload response"));
                }
            } else {
                reject(new Error(xhr.responseText || "Upload failed"));
            }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.open("POST", "/api/storage/upload");
        // Cookie is sent automatically — no Authorization header needed
        xhr.send(formData);
    });
};

// ─── Backward-compat aliases ─────────────────────────────────

/** Alias for getAllSubmissions */
export const getAllHomework = getAllSubmissions;

/** Alias for deleteSubmission */
export const deleteHomework = deleteSubmission;

/** Admin cleanup function — removes submissions for completed batches */
export const cleanupCompletedBatchHomework = async (batches: string | { batchName: string; completedAt: Date }[]): Promise<{ deleted: number }> => {
    const payload = typeof batches === 'string' 
        ? { batches: [{ batchName: batches, completedAt: new Date() }] }
        : { batches };

    const res = await fetch("/api/homework/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to cleanup homework.");
    return { deleted: data.deleted || 0 };
};

/** Get homework assignments for a teacher */
export const getHomeworkAssignmentsByTeacher = getAssignmentsByTeacher;

/** Get submissions by teacher name */
export const getHomeworkByTeacher = getSubmissionsByTeacher;

/** Get active assignments for a student by batch */
export const getActiveHomeworkAssignmentsForStudent = getAssignmentsByBatch;

/** Get submissions by student UID */
export const getHomeworkByStudent = getSubmissionsByStudent;

/** Create a new assignment (alias) */
export const createHomeworkAssignment = addAssignment;

/** Delete an assignment (alias) */
export const deleteHomeworkAssignment = deleteAssignment;

/** Update an assignment */
export const updateHomeworkAssignment = async (id: string, data: Partial<Omit<HomeworkAssignment, "id" | "createdAt">>): Promise<void> => {
    const res = await fetch("/api/homework/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) throw new Error("Failed to update assignment.");
};

/** Upload multiple homework files sequentially */
export const uploadMultipleHomeworkFiles = async (
    files: File[],
    onProgress?: (fileIndex: number, progress: number) => void
): Promise<HomeworkFile[]> => {
    const results: HomeworkFile[] = [];
    for (let i = 0; i < files.length; i++) {
        const result = await uploadHomeworkFile(files[i], (p) => onProgress?.(i, p));
        results.push(result);
    }
    return results;
};

/** Format a homework date string to local display format */
export const formatHomeworkDate = (date: string | Date): string => {
    if (!date) return "";
    try {
        const d = typeof date === "string" ? new Date(date) : date;
        return d.toLocaleDateString("en-BD", {
            year: "numeric", month: "short", day: "numeric"
        });
    } catch {
        return typeof date === "string" ? date : "";
    }
};


