export type QuizQuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
export type LabelStyle = "LETTERS" | "NUMBERS" | "ROMAN";
export type ReleaseMode = "IMMEDIATE" | "HELD";

export type QOption = { id: string; textHtml: string; isCorrect: boolean };

/** Client-side question draft. `key` is a stable React key; `id` exists for saved questions. */
export type QDraft = {
    key: string;
    id?: string;
    type: QuizQuestionType;
    bodyHtml: string;
    marks: number;
    explanationHtml: string;
    tag: string;
    difficulty: string;
    timeLimitSeconds: number | null;
    options: QOption[];
    sourceBankItemId?: string;
    /** Saved question in a quiz that already has attempts — read-only. */
    locked?: boolean;
};

export type QuizSettings = {
    title: string;
    descriptionHtml: string;
    batchNames: string[];
    optionLabelStyle: LabelStyle;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    allowBacktrack: boolean;
    durationMinutes: string;
    maxAttempts: number;
    practiceModeAllowed: boolean;
    negativeMarkPerWrong: number;
    passPercentage: string;
    resultReleaseMode: ReleaseMode;
    resultReleaseAt: string;
    showLeaderboard: boolean;
    leaderboardShowNames: boolean;
    scheduleStart: string;
    scheduleEnd: string;
};

export const emptySettings: QuizSettings = {
    title: "",
    descriptionHtml: "",
    batchNames: [],
    optionLabelStyle: "LETTERS",
    shuffleQuestions: true,
    shuffleOptions: true,
    allowBacktrack: true,
    durationMinutes: "",
    maxAttempts: 1,
    practiceModeAllowed: false,
    negativeMarkPerWrong: 0,
    passPercentage: "",
    resultReleaseMode: "IMMEDIATE",
    resultReleaseAt: "",
    showLeaderboard: true,
    leaderboardShowNames: true,
    scheduleStart: "",
    scheduleEnd: "",
};

export type Batch = { id: string; name: string };

export type QuizListItem = {
    id: string;
    title: string;
    batchNames: string[];
    isActive: boolean;
    scheduleStart: string | null;
    scheduleEnd: string | null;
    createdByName: string;
    createdByUid: string;
    resultReleaseMode: ReleaseMode;
    resultsReleasedAt: string | null;
    _count: { questions: number; attempts: number };
};

export const TYPE_LABEL: Record<QuizQuestionType, string> = {
    SINGLE_CHOICE: "Single choice",
    MULTI_CHOICE: "Multiple choice",
    TRUE_FALSE: "True / False",
    SHORT_ANSWER: "Short answer",
};

export const DIFFICULTIES = ["", "easy", "medium", "hard"];

export function uid(): string {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];

export function optionLabel(style: LabelStyle, index: number): string {
    if (style === "NUMBERS") return String(index + 1);
    if (style === "ROMAN") return ROMAN[index] ?? String(index + 1);
    return String.fromCharCode(65 + (index % 26));
}

export function stripHtml(html: string): string {
    return (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function textToHtml(s: string): string {
    return s.trim() ? `<p>${escapeHtml(s.trim())}</p>` : "";
}

export function newOption(textHtml = "", isCorrect = false): QOption {
    return { id: uid(), textHtml, isCorrect };
}

export function trueFalseOptions(correctTrue: boolean | null = null): QOption[] {
    return [newOption("<p>True (সত্য)</p>", correctTrue === true), newOption("<p>False (মিথ্যা)</p>", correctTrue === false)];
}

export function newQuestion(type: QuizQuestionType = "SINGLE_CHOICE"): QDraft {
    return {
        key: uid(),
        type,
        bodyHtml: "",
        marks: 1,
        explanationHtml: "",
        tag: "",
        difficulty: "",
        timeLimitSeconds: null,
        options: type === "SHORT_ANSWER" ? [] : type === "TRUE_FALSE" ? trueFalseOptions() : [newOption(), newOption(), newOption(), newOption()],
    };
}

/** Change the question type, converting options sensibly. */
export function convertType(q: QDraft, type: QuizQuestionType): QDraft {
    if (type === q.type) return q;
    if (type === "SHORT_ANSWER") return { ...q, type, options: [] };
    if (type === "TRUE_FALSE") return { ...q, type, options: trueFalseOptions() };
    let options = q.options.length >= 2 && q.type !== "TRUE_FALSE" ? q.options : [newOption(), newOption(), newOption(), newOption()];
    if (type === "SINGLE_CHOICE") {
        let seen = false;
        options = options.map((o) => {
            if (o.isCorrect && !seen) { seen = true; return o; }
            return o.isCorrect ? { ...o, isCorrect: false } : o;
        });
    }
    return { ...q, type, options };
}

/** Shape sent to the API. */
export function serializeQuestion(q: QDraft) {
    return {
        type: q.type,
        bodyHtml: q.bodyHtml,
        marks: q.marks,
        explanationHtml: q.explanationHtml,
        tag: q.tag || undefined,
        difficulty: q.difficulty || undefined,
        timeLimitSeconds: q.timeLimitSeconds,
        options: q.type === "SHORT_ANSWER" ? [] : q.options,
        sourceBankItemId: q.sourceBankItemId,
    };
}

export function validateQuestion(q: QDraft): string | null {
    if (!stripHtml(q.bodyHtml) && !/<img/i.test(q.bodyHtml)) return "প্রশ্নের বডি খালি";
    if (q.type === "SHORT_ANSWER") return null;
    if (q.options.length < 2) return "কমপক্ষে ২টি অপশন দরকার";
    if (q.options.some((o) => !stripHtml(o.textHtml) && !/<img/i.test(o.textHtml))) return "কিছু অপশন খালি";
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (correct === 0) return "সঠিক উত্তর চিহ্নিত করা হয়নি";
    if (q.type !== "MULTI_CHOICE" && correct !== 1) return "ঠিক একটি সঠিক উত্তর হবে";
    return null;
}

/** ISO string -> value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
