// ============================================================
// feedbackService — anonymous course-wise student feedback
// ============================================================

export type FeedbackCategory = "CourseContent" | "Teacher" | "Facilities" | "Administration" | "Other";

/** Shape returned to teacher/admin — never includes student identity. */
export interface Feedback {
    id: string;
    batchName: string;
    category: FeedbackCategory;
    message: string;
    rating: number;
    isRead: boolean;
    createdAt: string;
}

/** Shape returned to a super_admin session only. */
export interface FeedbackWithIdentity extends Feedback {
    studentUid: string;
    studentName: string;
    studentRoll: string;
    courseId: string;
    course?: { id: string; slug: string; name: string };
}

export interface FeedbackFilters {
    category?: FeedbackCategory;
    isRead?: boolean;
    /** Include archived/completed batches too — defaults to running-only. */
    allBatches?: boolean;
}

const buildQuery = (filters: FeedbackFilters = {}): string => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.isRead !== undefined) params.set("isRead", String(filters.isRead));
    if (filters.allBatches) params.set("allBatches", "true");
    const qs = params.toString();
    return qs ? `?${qs}` : "";
};

/** Teacher/admin: anonymized feedback for their own course. */
export const getFeedbackList = async (filters: FeedbackFilters = {}): Promise<Feedback[]> => {
    const res = await fetch(`/api/feedback${buildQuery(filters)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const setFeedbackRead = async (id: string, isRead: boolean): Promise<void> => {
    const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isRead }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update feedback.");
    }
};

export const deleteFeedback = async (id: string): Promise<void> => {
    const res = await fetch(`/api/feedback?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete feedback.");
    }
};

/** Student: submit anonymous feedback from the student portal. */
export const submitFeedback = async (
    category: FeedbackCategory,
    message: string,
    rating: number
): Promise<void> => {
    const res = await fetch("/api/student/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, rating }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to submit feedback.");
    }
};

/**
 * SSE-based realtime subscription for unread feedback (teacher/admin
 * sidebar/dashboard badges). Returns an unsubscribe function.
 */
export const subscribeToUnreadFeedback = (
    callback: (feedbacks: Feedback[]) => void
): (() => void) => {
    const controller = new AbortController();

    const connect = () => {
        const eventSource = new EventSource("/api/sse/notifications");

        eventSource.addEventListener("feedback", (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.pendingFeedback) {
                    callback(data.pendingFeedback);
                }
            } catch { /* ignore parse errors */ }
        });

        eventSource.onerror = () => {
            eventSource.close();
            if (!controller.signal.aborted) {
                setTimeout(connect, 5000);
            }
        };

        controller.signal.addEventListener("abort", () => {
            eventSource.close();
        });
    };

    connect();

    return () => controller.abort();
};

/** Super admin only: feedback with the submitting student's identity. */
export const getFeedbackWithIdentity = async (
    filters: FeedbackFilters & { courseId?: string } = {}
): Promise<FeedbackWithIdentity[]> => {
    const params = new URLSearchParams();
    if (filters.courseId) params.set("courseId", filters.courseId);
    if (filters.category) params.set("category", filters.category);
    if (filters.isRead !== undefined) params.set("isRead", String(filters.isRead));
    const qs = params.toString();
    const res = await fetch(`/api/saas/feedback${qs ? `?${qs}` : ""}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};
