// ============================================================
// studentUpdateService — All Firestore calls replaced with API calls
// ============================================================

export interface StudentUpdateRequest {
    id: string;
    studentUid: string;
    studentName: string;
    studentBatchName: string;
    studentRoll: string;
    proposedChanges: Partial<{
        phone: string;
        address: string;
        dob: string;
        educationalDegree: string;
        category: "Alim" | "General" | "";
        bloodGroup: string;
        email: string;
        nidBirthNo: string;
        fatherName: string;
        motherName: string;
        permanentAddress: string;
        guardianName: string;
        guardianPhone: string;
        lastInstitute: string;
        latestDegree: string;
        gpaResult: string;
        currentDistrict: string;
        homeDistrict: string;
        tShirtSize: string;
        courseGoal: string;
        courseStatus: string;
        currentlyDoing: string;
        companyName: string;
        businessName: string;
        salary: string;
    }>;
    currentData: Record<string, unknown>;
    status: "pending" | "approved" | "rejected";
    submittedAt: string | Date;
    reviewedAt?: string | Date;
    reviewedBy?: string;
    adminNote?: string;
}

export const submitUpdateRequest = async (
    studentUid: string,
    studentName: string,
    batchName: string,
    roll: string,
    proposedChanges: StudentUpdateRequest["proposedChanges"],
    currentData: Record<string, unknown>
): Promise<void> => {
    const res = await fetch("/api/student/update-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentUid, studentName, batchName, roll, proposedChanges, currentData }),
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit update request.");
    }
};

export const getAllUpdateRequests = async (): Promise<StudentUpdateRequest[]> => {
    const res = await fetch("/api/student/update-request", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
};

export const approveUpdateRequest = async (requestId: string, reviewerName: string): Promise<void> => {
    const res = await fetch("/api/student/update-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "approve", reviewerName }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to approve update request.");
    }
};

export const rejectUpdateRequest = async (requestId: string, reviewerName: string, adminNote: string): Promise<void> => {
    const res = await fetch("/api/student/update-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "reject", reviewerName, adminNote }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to reject update request.");
    }
};
