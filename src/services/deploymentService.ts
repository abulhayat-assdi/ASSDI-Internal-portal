// ============================================================
// deploymentService.ts — Client-side fetch helpers
// ============================================================

export interface Deployment {
    id: string;
    userId: string;
    subdomain: string;
    displayName: string;
    folderPath: string;
    liveUrl: string;
    totalVisitors: number;
    sizeBytes: number;
    riskFlags: string[];
    createdAt: string;
    updatedAt: string;
}

export interface DeploymentWithUser extends Deployment {
    user: {
        id: string;
        displayName: string;
        studentBatchName: string | null;
        studentRoll: string | null;
        deploymentLimit: number;
        isDeploymentFrozen: boolean;
        deployAfterBatchEnd: boolean;
    };
    batchCompleted: boolean;
}

export interface StudentDeploymentData {
    deployments: Deployment[];
    deploymentLimit: number;
    isDeploymentFrozen: boolean;
    /** Why new deploys/updates are blocked (frozen, batch completed), or null. */
    blockedReason: string | null;
    usedBytes: number;
    quotaBytes: number;
    /** "https://<main domain>/site" — a deployment lives at <siteBaseUrl>/<subdomain>. */
    siteBaseUrl: string;
}

// ─── Response handling ────────────────────────────────────────────────────────

/**
 * Turns an HTTP status into a message a student can act on. Used when the
 * response isn't our JSON at all — a proxy timeout or gateway error page is
 * HTML, and calling res.json() on it is what produced the cryptic
 * "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" error.
 */
function messageForStatus(status: number, fallback: string): string {
    if (status === 401) return "আপনার সেশনের মেয়াদ শেষ। আবার লগইন করুন।";
    if (status === 403) return "এই কাজটি করার অনুমতি আপনার নেই।";
    if (status === 404) return "পাওয়া যায়নি। পেজটি রিফ্রেশ করুন।";
    if (status === 413) return "ফাইলটি সার্ভারের জন্য অনেক বড়। ছোট করে (সর্বোচ্চ 50MB) আবার চেষ্টা করুন।";
    if (status === 429) return "অনেকবার চেষ্টা করা হয়েছে। একটু পর আবার চেষ্টা করুন।";
    if (status === 502 || status === 503) return "সার্ভার রিস্টার্ট হচ্ছে বা সাময়িকভাবে বন্ধ। এক মিনিট পর আবার চেষ্টা করুন।";
    if (status === 504 || status === 408) return "সার্ভার সময়মতো সাড়া দেয়নি (timeout)। আবার চেষ্টা করুন; ফাইল বড় হলে ছোট করুন বা দ্রুত ইন্টারনেট ব্যবহার করুন।";
    if (status >= 500) return "সার্ভারে সমস্যা হয়েছে। এক মিনিট পর আবার চেষ্টা করুন।";
    return fallback;
}

/** Parses a response body as JSON without ever throwing a JSON syntax error. */
function parseBody(text: string): Record<string, unknown> | null {
    if (!text) return null;
    try {
        const data = JSON.parse(text);
        return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

async function request<T>(input: string, init: RequestInit | undefined, fallback: string): Promise<T> {
    let res: Response;
    try {
        res = await fetch(input, init);
    } catch {
        throw new Error("সার্ভারের সাথে সংযোগ করা যাচ্ছে না। ইন্টারনেট চেক করে আবার চেষ্টা করুন।");
    }
    const data = parseBody(await res.text().catch(() => ""));
    if (!res.ok || !data) {
        const serverMsg = typeof data?.error === "string" ? data.error : null;
        throw new Error(serverMsg ?? messageForStatus(res.status, fallback));
    }
    return data as T;
}

// ─── Student ──────────────────────────────────────────────────────────────────

export async function getMyDeployments(): Promise<StudentDeploymentData> {
    return request("/api/deployments", { cache: "no-store" }, "ডিপ্লয়মেন্টগুলো লোড করা যায়নি।");
}

export interface SubdomainCheck {
    available: boolean;
    reason?: "invalid" | "taken" | "error";
    error?: string;
}

export async function validateSubdomain(subdomain: string, excludeId?: string): Promise<SubdomainCheck> {
    const params = new URLSearchParams({ subdomain });
    if (excludeId) params.set("excludeId", excludeId);
    try {
        return await request<SubdomainCheck>(
            `/api/deployments/validate-subdomain?${params.toString()}`,
            { cache: "no-store" },
            "চেক করা যায়নি।"
        );
    } catch (err) {
        return { available: false, reason: "error", error: err instanceof Error ? err.message : "চেক করা যায়নি।" };
    }
}

/** The upload never got a response — the deployment may or may not have been created. */
export class DeployNetworkError extends Error {}

export interface UploadResult {
    deployment: Deployment;
    /** SVG/XML files the server left out. */
    skippedFiles?: string[];
}

/**
 * Uploads with XMLHttpRequest rather than fetch so the form can show real
 * upload progress — on a slow connection a 20MB ZIP used to sit on
 * "Deploying..." for minutes with no sign of life.
 */
function uploadWithProgress(
    method: "POST" | "PUT",
    url: string,
    formData: FormData,
    onProgress?: (fraction: number) => void
): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.timeout = 10 * 60 * 1000;
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
        };
        xhr.onload = () => {
            const data = parseBody(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data?.deployment) {
                resolve(data as unknown as UploadResult);
                return;
            }
            const serverMsg = typeof data?.error === "string" ? data.error : null;
            reject(new Error(serverMsg ?? messageForStatus(xhr.status, "ডিপ্লয় হয়নি। আবার চেষ্টা করুন।")));
        };
        xhr.onerror = () => reject(new DeployNetworkError(
            "আপলোডের সময় ইন্টারনেট সংযোগ কেটে গেছে। ইন্টারনেট চেক করে আবার চেষ্টা করুন।"
        ));
        xhr.ontimeout = () => reject(new DeployNetworkError(
            "আপলোড অনেক সময় নিয়েছে (timeout)। ফাইল ছোট করুন বা দ্রুত ইন্টারনেট ব্যবহার করে আবার চেষ্টা করুন।"
        ));
        xhr.send(formData);
    });
}

export function deployProject(formData: FormData, onProgress?: (fraction: number) => void): Promise<UploadResult> {
    return uploadWithProgress("POST", "/api/deployments", formData, onProgress);
}

/** Replaces a site's files; the URL and visitor count stay the same. */
export function updateDeploymentFiles(id: string, file: File, onProgress?: (fraction: number) => void): Promise<UploadResult> {
    const fd = new FormData();
    fd.append("file", file);
    return uploadWithProgress("PUT", `/api/deployments/${id}`, fd, onProgress);
}

export interface DeploymentStats {
    totalVisitors: number;
    days: { date: string; visitors: number }[];
}

export async function getDeploymentStats(id: string): Promise<DeploymentStats> {
    return request(`/api/deployments/${id}/stats`, { cache: "no-store" }, "পরিসংখ্যান লোড করা যায়নি।");
}

export async function updateDeployment(
    id: string,
    payload: { subdomain?: string; displayName?: string }
): Promise<{ deployment: Deployment }> {
    return request(`/api/deployments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }, "সেভ করা যায়নি।");
}

export async function deleteDeployment(id: string): Promise<void> {
    await request(`/api/deployments/${id}`, { method: "DELETE" }, "ডিলিট করা যায়নি।");
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAllDeployments(
    search?: string
): Promise<{ deployments: DeploymentWithUser[]; stats: { total: number; totalVisitors: number; totalBytes: number; flagged: number } }> {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    return request(`/api/deployments/admin${params}`, { cache: "no-store" }, "Failed to fetch deployments.");
}

export async function getStudentDeploymentData(
    userId: string
): Promise<{
    user: DeploymentWithUser["user"];
    deployments: Deployment[];
    batchCompleted: boolean;
    blockedReason: string | null;
    usedBytes: number;
    quotaBytes: number;
}> {
    return request(`/api/deployments/admin/student/${userId}`, { cache: "no-store" }, "Failed to fetch student deployments.");
}

export async function updateStudentDeploymentSettings(
    userId: string,
    payload: { deploymentLimit?: number; isDeploymentFrozen?: boolean; deployAfterBatchEnd?: boolean }
): Promise<void> {
    await request(`/api/deployments/admin/student/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }, "Update failed.");
}

export async function adminDeleteDeployment(id: string): Promise<void> {
    await request(`/api/deployments/${id}`, { method: "DELETE" }, "Delete failed.");
}
