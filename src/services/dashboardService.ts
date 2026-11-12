// ============================================================
// dashboardService — All Firestore calls replaced with API calls
// ============================================================

export interface Class {
    id: string;
    date: string;
    day: string;
    batch: string;
    subject: string;
    time: string;
    status: "Today" | "Completed" | "Pending" | "Upcoming" | "COMPLETED" | "PENDING";
}

export interface Notice {
    id: string;
    title: string;
    description: string;
    date: string;
    priority: "normal" | "urgent";
    createdBy?: string;
    createdByName?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface StudentNotice {
    id: string;
    title: string;
    description: string;
    date: string;
    priority: "normal" | "urgent";
    /** Target batch name, or "all" for every batch. */
    batchName?: string;
    createdBy?: string;
    createdByName?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
}

// --- Notices ---

export const addNotice = async (notice: Omit<Notice, "id">): Promise<string> => {
    const res = await fetch("/api/dashboard/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notice),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add notice.");
    return data.id;
};

export const updateNotice = async (id: string, data: Partial<Omit<Notice, "id">>): Promise<void> => {
    const res = await fetch("/api/dashboard/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to update notice.");
    }
};

export const deleteNotice = async (id: string): Promise<void> => {
    const res = await fetch(`/api/dashboard/notices?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to delete notice.");
    }
};

export const getAllNotices = async (): Promise<Notice[]> => {
    const res = await fetch("/api/dashboard/notices", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

// --- Student Notices ---

export const addStudentNotice = async (notice: Omit<StudentNotice, "id">): Promise<string> => {
    const res = await fetch("/api/dashboard/student-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notice),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add student notice.");
    return data.id;
};

/**
 * Students always get their own batch + course-wide notices (enforced server-side).
 * Teachers/admins get everything, or one batch's view when `batchName` is given.
 */
export const getAllStudentNotices = async (batchName?: string): Promise<StudentNotice[]> => {
    const qs = batchName ? `?batchName=${encodeURIComponent(batchName)}` : "";
    const res = await fetch(`/api/dashboard/student-notices${qs}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const updateStudentNotice = async (id: string, data: Partial<Omit<StudentNotice, "id">>): Promise<void> => {
    const res = await fetch("/api/dashboard/student-notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to update student notice.");
    }
};

export const deleteStudentNotice = async (id: string): Promise<void> => {
    const res = await fetch(`/api/dashboard/student-notices?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to delete student notice.");
    }
};

// --- Classes ---

export const getAllClasses = async (): Promise<Class[]> => {
    const res = await fetch("/api/dashboard/classes", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const getTodayClassesCount = (classes: Class[]): number => {
    const today = new Date().toISOString().split("T")[0];
    return classes.filter((cls) => cls.date === today).length;
};

export const getCompletedClassesThisMonth = (classes: Class[]): number => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    return classes.filter((cls) => {
        const classDate = new Date(cls.date);
        return (
            (cls.status === "COMPLETED" || cls.status === "Completed") &&
            classDate.getMonth() === currentMonth &&
            classDate.getFullYear() === currentYear
        );
    }).length;
};

export const getPendingClassesThisMonth = (classes: Class[]): number => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    return classes.filter((cls) => {
        const classDate = new Date(cls.date);
        return (
            (cls.status === "PENDING" || cls.status === "Pending") &&
            classDate.getMonth() === currentMonth &&
            classDate.getFullYear() === currentYear
        );
    }).length;
};

export const getMonthlyClassStats = async (): Promise<{ total: number; completed: number; pending: number }> => {
    const res = await fetch("/api/dashboard/monthly-stats", { cache: "no-store" });
    if (!res.ok) return { total: 0, completed: 0, pending: 0 };
    return res.json();
};
