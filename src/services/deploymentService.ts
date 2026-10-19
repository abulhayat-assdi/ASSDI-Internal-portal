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
    };
}

export interface StudentDeploymentData {
    deployments: Deployment[];
    deploymentLimit: number;
    isDeploymentFrozen: boolean;
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
    if (status === 401) return "Your session has expired. Please log in again.";
    if (status === 403) return "You don't have permission to do this.";
    if (status === 404) return "Not found. Please refresh the page.";
    if (status === 413) return "The file is too large for the server to accept. Make it smaller (max 50MB) and try again.";
    if (status === 429) return "Too many requests. Please wait a moment and try again.";
    if (status === 502 || status === 503) return "The server is restarting or temporarily unavailable. Please wait a minute and try again.";
    if (status === 504 || status === 408) return "The server took too long to respond (timeout). Try again; if your file is large, make it smaller or use a faster connection.";
    if (status >= 500) return "Server error. Please try again in a minute.";
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
        throw new Error("Could not reach the server. Check your internet connection and try again.");
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
    return request("/api/deployments", { cache: "no-store" }, "Failed to load deployments.");
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
            "Could not check availability."
        );
    } catch (err) {
        return { available: false, reason: "error", error: err instanceof Error ? err.message : "Could not check availability." };
    }
}

/** The upload never got a response — the deployment may or may not have been created. */
export class DeployNetworkError extends Error {}

/**
 * Uploads with XMLHttpRequest rather than fetch so the form can show real
 * upload progress — on a slow connection a 20MB ZIP used to sit on
 * "Deploying..." for minutes with no sign of life.
 */
export function deployProject(
    formData: FormData,
    onProgress?: (fraction: number) => void
): Promise<{ deployment: Deployment; liveUrl: string }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/deployments");
        xhr.timeout = 10 * 60 * 1000;
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
        };
        xhr.onload = () => {
            const data = parseBody(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data?.deployment) {
                resolve(data as unknown as { deployment: Deployment; liveUrl: string });
                return;
            }
            const serverMsg = typeof data?.error === "string" ? data.error : null;
            reject(new Error(serverMsg ?? messageForStatus(xhr.status, "Deployment failed. Please try again.")));
        };
        xhr.onerror = () => reject(new DeployNetworkError(
            "The connection was interrupted during upload. Check your internet connection and try again."
        ));
        xhr.ontimeout = () => reject(new DeployNetworkError(
            "The upload took too long and timed out. Make the file smaller or use a faster connection, then try again."
        ));
        xhr.send(formData);
    });
}

export async function updateDeployment(
    id: string,
    payload: { subdomain?: string; displayName?: string }
): Promise<{ deployment: Deployment }> {
    return request(`/api/deployments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }, "Update failed.");
}

export async function deleteDeployment(id: string): Promise<void> {
    await request(`/api/deployments/${id}`, { method: "DELETE" }, "Delete failed.");
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAllDeployments(
    search?: string
): Promise<{ deployments: DeploymentWithUser[]; stats: { total: number; totalVisitors: number } }> {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    return request(`/api/deployments/admin${params}`, { cache: "no-store" }, "Failed to fetch deployments.");
}

export async function getStudentDeploymentData(
    userId: string
): Promise<{ user: DeploymentWithUser["user"]; deployments: Deployment[] }> {
    return request(`/api/deployments/admin/student/${userId}`, { cache: "no-store" }, "Failed to fetch student deployments.");
}

export async function updateStudentDeploymentSettings(
    userId: string,
    payload: { deploymentLimit?: number; isDeploymentFrozen?: boolean }
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
