/**
 * Homework grading rules shared by the API routes and the pages.
 * Pure functions only — no server or browser imports — so both sides agree
 * and the rules are unit-tested in one place.
 */

/** Highest total a folder may be marked out of. */
export const MAX_TOTAL_MARKS = 1000;
export const MAX_FEEDBACK_LENGTH = 5000;
export const MAX_COMMENT_LENGTH = 2000;

const roundTo2 = (n: number) => Math.round(n * 100) / 100;

/** Parses a total-marks value; returns the number or a Bangla error. */
export function parseTotalMarks(value: unknown): { ok: true; value: number } | { ok: false; error: string } {
    const n = typeof value === "string" ? Number(value.trim()) : typeof value === "number" ? value : NaN;
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "মোট মার্কস ০-এর চেয়ে বড় একটি সংখ্যা হতে হবে।" };
    if (n > MAX_TOTAL_MARKS) return { ok: false, error: `মোট মার্কস সর্বোচ্চ ${MAX_TOTAL_MARKS} হতে পারে।` };
    if (roundTo2(n) !== n) return { ok: false, error: "মোট মার্কসে সর্বোচ্চ ২ ঘর দশমিক দেওয়া যাবে।" };
    return { ok: true, value: n };
}

/**
 * Parses a mark given out of `total`. null/"" clears the mark.
 * Returns the number (or null) or a Bangla error.
 */
export function parseMarks(value: unknown, total: number): { ok: true; value: number | null } | { ok: false; error: string } {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
        return { ok: true, value: null };
    }
    const n = typeof value === "string" ? Number(value.trim()) : typeof value === "number" ? value : NaN;
    if (!Number.isFinite(n)) return { ok: false, error: "মার্কস একটি সংখ্যা হতে হবে।" };
    if (n < 0) return { ok: false, error: "মার্কস ০-এর কম হতে পারে না।" };
    if (n > total) return { ok: false, error: `মার্কস মোট ${formatMarks(total)}-এর বেশি হতে পারে না।` };
    if (roundTo2(n) !== n) return { ok: false, error: "মার্কসে সর্বোচ্চ ২ ঘর দশমিক দেওয়া যাবে।" };
    return { ok: true, value: n };
}

/** 15 → "15", 7.5 → "7.5" */
export function formatMarks(n: number | null | undefined): string {
    if (n === null || n === undefined) return "";
    return String(roundTo2(n));
}

export interface GradableSubmission {
    id: string;
    studentName: string;
    studentRoll: string;
    studentBatchName: string;
    marks?: number | null;
    feedback?: string | null;
    returnedAt?: string | Date | null;
}

export type GradeStatus = "not_graded" | "graded" | "returned";

/** "graded" = has a mark (when marks are on) or written feedback, not yet returned. */
export function gradeStatus(sub: GradableSubmission, marksEnabled: boolean): GradeStatus {
    if (sub.returnedAt) return "returned";
    return isGraded(sub, marksEnabled) ? "graded" : "not_graded";
}

export function isGraded(sub: GradableSubmission, marksEnabled: boolean): boolean {
    if (marksEnabled) return sub.marks !== null && sub.marks !== undefined;
    return !!sub.feedback?.trim();
}

export const GRADE_STATUS_LABEL: Record<GradeStatus, string> = {
    not_graded: "Not graded",
    graded: "Graded (not returned)",
    returned: "Returned",
};

/** Submissions whose mark would exceed a new, lower total. */
export function submissionsOverTotal<T extends GradableSubmission>(subs: T[], total: number): T[] {
    return subs.filter((s) => s.marks !== null && s.marks !== undefined && s.marks > total);
}

/** Numeric-aware roll comparison: "2" < "10", non-numeric rolls after. */
export function compareRoll(a: string, b: string): number {
    return (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" });
}

export interface MarksExportRow {
    [key: string]: string | number;
    Roll: string;
    Name: string;
    Batch: string;
    Homework: string;
    Marks: number | string;
    Total: number;
    Feedback: string;
    Status: string;
}

export const MARKS_EXPORT_COLUMNS = ["Roll", "Name", "Batch", "Homework", "Marks", "Total", "Feedback", "Status"];

/**
 * One row per submitter (a student who submitted twice keeps only their
 * latest graded-or-newest submission), sorted by batch then roll.
 */
export function buildMarksExportRows(
    homeworkTitle: string,
    total: number,
    subs: (GradableSubmission & { submittedAt?: string })[]
): MarksExportRow[] {
    const byStudent = new Map<string, GradableSubmission & { submittedAt?: string }>();
    for (const s of subs) {
        const key = `${s.studentBatchName}::${s.studentRoll}::${s.studentName}`;
        const prev = byStudent.get(key);
        if (!prev) { byStudent.set(key, s); continue; }
        const prevGraded = prev.marks !== null && prev.marks !== undefined;
        const curGraded = s.marks !== null && s.marks !== undefined;
        if (curGraded && !prevGraded) byStudent.set(key, s);
        else if (curGraded === prevGraded && (s.submittedAt ?? "") > (prev.submittedAt ?? "")) byStudent.set(key, s);
    }
    return [...byStudent.values()]
        .sort((a, b) => a.studentBatchName.localeCompare(b.studentBatchName) || compareRoll(a.studentRoll, b.studentRoll))
        .map((s) => ({
            Roll: s.studentRoll,
            Name: s.studentName,
            Batch: s.studentBatchName,
            Homework: homeworkTitle,
            Marks: s.marks === null || s.marks === undefined ? "" : s.marks,
            Total: total,
            Feedback: (s.feedback ?? "").trim(),
            Status: GRADE_STATUS_LABEL[gradeStatus(s, true)],
        }));
}

/** Grading fields a student must not see before the teacher returns the work. */
const HIDDEN_UNTIL_RETURNED = ["marks", "feedback", "gradedAt", "gradedByUid", "gradedByName"] as const;

export function hideUnreturnedGrade<T extends Record<string, unknown>>(sub: T): T {
    if (sub.returnedAt) return sub;
    const copy: Record<string, unknown> = { ...sub };
    for (const k of HIDDEN_UNTIL_RETURNED) copy[k] = null;
    return copy as T;
}

// ─── File viewer ────────────────────────────────────────────

export type ViewerKind = "image" | "pdf" | "video" | "audio" | "office" | "text" | "html" | "other";

const KIND_BY_EXT: Record<string, ViewerKind> = {
    jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", avif: "image", bmp: "image",
    pdf: "pdf",
    mp4: "video", webm: "video", mov: "video", m4v: "video",
    mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio",
    doc: "office", docx: "office", xls: "office", xlsx: "office", ppt: "office", pptx: "office",
    txt: "text", md: "text", markdown: "text", csv: "text",
    html: "html", htm: "html", svg: "html",
};

export function fileExtension(fileName: string): string {
    const m = /\.([a-z0-9]{1,10})$/i.exec((fileName || "").split("?")[0]);
    return m ? m[1].toLowerCase() : "";
}

export function viewerKind(fileName: string): ViewerKind {
    return KIND_BY_EXT[fileExtension(fileName)] ?? "other";
}

/** Microsoft's Office Online viewer refuses files above these sizes. */
export function officeViewerLimitBytes(fileName: string): number {
    const ext = fileExtension(fileName);
    return ext === "xls" || ext === "xlsx" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
}
