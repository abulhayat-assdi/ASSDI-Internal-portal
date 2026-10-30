import type { HomeworkFile, HomeworkSubmission } from "@/services/homeworkService";

// ZIPs are assembled in the browser. Bound memory use even for legacy files
// without size metadata; actual response bytes are checked while downloading.
export const MAX_HOMEWORK_ZIP_BYTES = 250 * 1024 * 1024;
const SIZE_ERROR = "These submissions exceed the 250 MB ZIP download limit. Search by student name or roll number to download a smaller group.";

export function formatHomeworkSubmittedAt(hw: HomeworkSubmission): string {
    const date = hw.submittedAt ? new Date(hw.submittedAt) : null;
    if (!date || Number.isNaN(date.getTime())) return hw.submissionDate;
    return date.toLocaleString("en-GB", {
        timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
}

export function getHomeworkFiles(hw: HomeworkSubmission): HomeworkFile[] {
    if (hw.files?.length) return hw.files;
    return hw.fileName || hw.storagePath || hw.fileUrl
        ? [{ fileName: hw.fileName || "attachment", storagePath: hw.storagePath || "", url: hw.fileUrl || "" }]
        : [];
}

/** One portable filename segment, never an absolute path or ZIP traversal. */
export function safeHomeworkName(value: string, fallback = "homework"): string {
    const clean = value.normalize("NFC")
        .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_")
        .replace(/^[.\s]+|[.\s]+$/g, "");
    // Keep the extension when shortening a long original filename.
    const extension = clean.match(/\.[a-zA-Z0-9]{1,12}$/)?.[0] || "";
    const shortened = Array.from(clean).length > 100
        ? Array.from(clean.slice(0, clean.length - extension.length)).slice(0, 100 - extension.length).join("") + extension
        : clean;
    const name = shortened.replace(/[.\s]+$/g, "") || fallback;
    return /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}

export function homeworkExportName(title: string, extension: "xlsx" | "zip"): string {
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
    return `${safeHomeworkName(title)}_submissions_${date}.${extension}`;
}

export async function createHomeworkWorkbook(submissions: HomeworkSubmission[], folders?: string[]) {
    const XLSX = await import("xlsx");
    const rows: (string | number)[][] = [[
        "SL", "Student Name", "Roll Number", "Batch Name", "Submitted At", "Text / Link", "Uploaded Files",
        ...(folders ? ["Files Folder"] : []),
    ]];
    submissions.forEach((hw, index) => {
        const count = getHomeworkFiles(hw).length;
        rows.push([
            index + 1, hw.studentName, hw.studentRoll, hw.studentBatchName,
            formatHomeworkSubmittedAt(hw), (hw.textContent ?? "").trim().slice(0, 32767),
            count ? `${count} file(s) uploaded` : "-", ...(folders ? [folders[index]] : []),
        ]);
    });
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [5, 25, 14, 18, 22, 60, 18, ...(folders ? [60] : [])].map(wch => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Submissions");
    return workbook;
}

export async function downloadHomeworkExcel(title: string, submissions: HomeworkSubmission[], signal?: AbortSignal) {
    if (!submissions.length) throw new Error("There are no submissions to download.");
    const XLSX = await import("xlsx");
    const workbook = await createHomeworkWorkbook(submissions);
    signal?.throwIfAborted();
    XLSX.writeFile(workbook, homeworkExportName(title, "xlsx"));
}

/** Only fetch local homework through the existing authenticated file route. */
export function homeworkFileDownloadUrl(file: HomeworkFile, studentUid: string): string {
    let storedPath = file.storagePath;
    if (!storedPath && file.url) {
        // Absolute legacy URLs are accepted only on this portal's origin.
        const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
        const url = new URL(file.url, origin);
        if (url.origin !== origin) throw new Error("This attachment is not stored on this portal.");
        storedPath = url.pathname === "/api/file"
            ? url.searchParams.get("path") || ""
            : decodeURIComponent(url.pathname);
    }
    const normalized = storedPath.replace(/\\/g, "/").replace(/^\/+/, "")
        .replace(/^(api\/uploads\/|uploads\/|storage\/(public|private)\/)/, "");
    const parts = normalized.split("/");
    if (parts[0] !== "homework" || parts[1] !== studentUid || parts.length < 3 ||
        parts.some(part => !part || part === "." || part === ".." || /[\u0000-\u001f]/.test(part))) {
        throw new Error("This attachment has an invalid storage location.");
    }
    return `/api/file?path=${encodeURIComponent(normalized)}`;
}

async function readAttachment(response: Response, remainingBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
    const announcedSize = Number(response.headers.get("content-length"));
    if (announcedSize > remainingBytes) {
        await response.body?.cancel();
        throw new Error(SIZE_ERROR);
    }
    if (!response.body) throw new Error("The file response was empty.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            signal?.throwIfAborted();
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > remainingBytes) throw new Error(SIZE_ERROR);
            chunks.push(value);
        }
    } catch (error) {
        await reader.cancel().catch(() => undefined);
        throw error;
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

interface ZipOptions {
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
}

/** All-or-nothing: a failed/missing attachment never produces a partial ZIP. */
export async function createHomeworkZip(submissions: HomeworkSubmission[], options: ZipOptions = {}): Promise<Blob> {
    if (!submissions.length) throw new Error("There are no submissions to download.");
    const { signal, onProgress } = options;
    signal?.throwIfAborted();
    const attachmentLists = submissions.map(getHomeworkFiles);
    const totalFiles = attachmentLists.reduce((sum, files) => sum + files.length, 0);
    const knownSize = attachmentLists.flat().reduce((sum, file) => sum + Math.max(0, file.size || 0), 0);
    if (knownSize > MAX_HOMEWORK_ZIP_BYTES) throw new Error(SIZE_ERROR);
    onProgress?.("Preparing ZIP...");
    const [{ default: JSZip }, XLSX] = await Promise.all([import("jszip"), import("xlsx")]);
    const zip = new JSZip();
    let downloaded = 0;
    let totalBytes = 0;
    const folders: string[] = [];

    for (let i = 0; i < submissions.length; i++) {
        signal?.throwIfAborted();
        const hw = submissions[i];
        const folder = `submissions/${String(i + 1).padStart(3, "0")}_${safeHomeworkName(`${hw.studentRoll || "no-roll"}_${hw.studentName || "student"}`)}`;
        folders.push(folder);
        const summary = [
            `Student: ${hw.studentName}`, `Roll: ${hw.studentRoll}`, `Batch: ${hw.studentBatchName}`,
            `Subject: ${hw.subject}`, `Submitted at: ${formatHomeworkSubmittedAt(hw)}`,
            `Submission ID: ${hw.id}`, "", "Text / Link:", hw.textContent ?? "",
        ].join("\r\n");
        const summaryBytes = new TextEncoder().encode("\uFEFF" + summary);
        totalBytes += summaryBytes.byteLength;
        if (totalBytes > MAX_HOMEWORK_ZIP_BYTES) throw new Error(SIZE_ERROR);
        zip.file(`${folder}/submission.txt`, summaryBytes);

        for (let j = 0; j < attachmentLists[i].length; j++) {
            const file = attachmentLists[i][j];
            onProgress?.(`Downloading files ${downloaded + 1}/${totalFiles}...`);
            try {
                const response = await fetch(homeworkFileDownloadUrl(file, hw.studentUid), {
                    credentials: "same-origin", cache: "no-store", redirect: "error", signal,
                });
                if (!response.ok) {
                    await response.body?.cancel();
                    throw new Error(response.status === 401 || response.status === 403
                        ? "Access denied. Please sign in again and check your access."
                        : response.status === 404 ? "The uploaded file could not be found."
                            : `The file could not be downloaded (HTTP ${response.status}).`);
                }
                // Auth middleware can return a sign-in page. Homework HTML is
                // served by /api/file with a sandbox CSP, unlike that page.
                if (response.headers.get("content-type")?.includes("text/html") &&
                    !response.headers.get("content-security-policy")?.includes("sandbox")) {
                    await response.body?.cancel();
                    throw new Error("Received a sign-in page instead of the file. Please sign in again.");
                }
                const bytes = await readAttachment(response, MAX_HOMEWORK_ZIP_BYTES - totalBytes, signal);
                totalBytes += bytes.byteLength;
                // Prefix guarantees uniqueness even on case-insensitive systems.
                zip.file(`${folder}/files/${String(j + 1).padStart(3, "0")}_${safeHomeworkName(file.fileName, "attachment")}`, bytes);
                downloaded++;
            } catch (error) {
                signal?.throwIfAborted();
                const reason = error instanceof Error ? error.message : "Download failed.";
                throw new Error(`${hw.studentName} (roll ${hw.studentRoll}), ${file.fileName}: ${reason} No ZIP was downloaded.`);
            }
        }
    }

    const workbook = await createHomeworkWorkbook(submissions, folders);
    const excelBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    totalBytes += excelBytes.byteLength;
    if (totalBytes > MAX_HOMEWORK_ZIP_BYTES) throw new Error(SIZE_ERROR);
    zip.file("submissions.xlsx", excelBytes);
    zip.file("README.txt", "Extract this ZIP before opening the files.\r\nsubmissions.xlsx lists the submissions and their folders.\r\nEach folder contains submission.txt (including the full text answer) and the uploaded files.\r\nFile numbers prevent duplicate filenames from overwriting each other.\r\n");
    signal?.throwIfAborted();
    // STORE avoids wasting CPU recompressing videos, images and Office files.
    return zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, metadata => {
        signal?.throwIfAborted();
        onProgress?.(`Creating ZIP ${Math.round(metadata.percent)}%...`);
    });
}

export function saveHomeworkZip(blob: Blob, title: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = homeworkExportName(title, "zip");
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser time to start reading the download before revoking it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
