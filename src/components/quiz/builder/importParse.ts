import { textToHtml, uid, trueFalseOptions, type QDraft, type QuizQuestionType } from "../types";

export type ParsedRow = { draft: QDraft; error: string | null };

const OPTION_RE = /^\(?([A-Za-z]|\d{1,2}|[ivxIVX]{2,4})[.)]\s+(.*)$/;
const KEY_RE = /^(answer|ans|correct|উত্তর|সঠিক)\s*[:：\-]\s*(.*)$/i;
const EXPL_RE = /^(explanation|expl|ব্যাখ্যা)\s*[:：\-]\s*(.*)$/i;
const META_RE = /^(marks|mark|মার্ক|tag|difficulty|time)\s*[:：\-]\s*(.*)$/i;

const ROMAN_MAP: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

/** "A" / "b" / "2" / "ii" -> zero-based index (or -1). */
function labelToIndex(label: string): number {
    const l = label.trim().toLowerCase();
    if (!l) return -1;
    if (/^\d+$/.test(l)) return Number(l) - 1;
    if (ROMAN_MAP[l] && l.length > 1) return ROMAN_MAP[l] - 1;
    if (/^[a-z]$/.test(l)) return l.charCodeAt(0) - 97;
    return -1;
}

function isTrueFalse(texts: string[]): boolean {
    const t = texts.map((x) => x.trim().toLowerCase());
    return t.length === 2 && t.includes("true") && t.includes("false");
}

/** Assemble and check one draft from loose parts, inferring the type. */
export function buildDraft(parts: {
    body: string;
    options: { text: string; correct: boolean }[];
    answerLabels: string[];
    answerText?: string;
    explanation?: string;
    marks?: number;
    tag?: string;
    difficulty?: string;
    timeLimitSeconds?: number | null;
    type?: QuizQuestionType;
}): ParsedRow {
    const opts = parts.options.map((o) => ({ ...o }));
    for (const lab of parts.answerLabels) {
        const idx = labelToIndex(lab);
        if (idx >= 0 && idx < opts.length) opts[idx].correct = true;
        else {
            const byText = opts.findIndex((o) => o.text.trim().toLowerCase() === lab.trim().toLowerCase());
            if (byText >= 0) opts[byText].correct = true;
        }
    }
    const correctCount = opts.filter((o) => o.correct).length;
    let type: QuizQuestionType = parts.type ?? "SINGLE_CHOICE";
    if (opts.length === 0) type = "SHORT_ANSWER";
    else if (!parts.type) type = isTrueFalse(opts.map((o) => o.text)) ? "TRUE_FALSE" : correctCount > 1 ? "MULTI_CHOICE" : "SINGLE_CHOICE";

    let options = type === "SHORT_ANSWER" ? [] : opts.map((o) => newOption2(o.text, o.correct));
    if (type === "TRUE_FALSE") {
        const trueIdx = opts.findIndex((o) => o.text.trim().toLowerCase() === "true");
        options = trueIdx >= 0 ? trueFalseOptions(opts[trueIdx].correct ? true : opts.some((o) => o.correct) ? false : null) : trueFalseOptions();
    }
    const explanation = parts.explanation || (type === "SHORT_ANSWER" && parts.answerText ? `Expected answer: ${parts.answerText}` : "");
    const draft: QDraft = {
        key: uid(),
        type,
        bodyHtml: textToHtml(parts.body),
        marks: parts.marks && parts.marks > 0 ? parts.marks : 1,
        explanationHtml: textToHtml(explanation),
        tag: parts.tag ?? "",
        difficulty: (parts.difficulty ?? "").toLowerCase(),
        timeLimitSeconds: parts.timeLimitSeconds && parts.timeLimitSeconds >= 5 ? parts.timeLimitSeconds : null,
        options,
    };
    let error: string | null = null;
    if (!parts.body.trim()) error = "প্রশ্ন খালি";
    else if (type !== "SHORT_ANSWER") {
        const c = options.filter((o) => o.isCorrect).length;
        if (options.length < 2) error = "কমপক্ষে ২টি অপশন দরকার";
        else if (c === 0) error = "সঠিক উত্তর পাওয়া যায়নি";
        else if (type !== "MULTI_CHOICE" && c !== 1) error = "একাধিক সঠিক উত্তর";
    }
    return { draft, error };
}

function newOption2(text: string, correct: boolean) {
    return { id: uid(), textHtml: textToHtml(text), isCorrect: correct };
}

/** Pasted text: blocks separated by blank lines — see the format hint in BulkImportModal. */
export function parsePastedText(text: string): ParsedRow[] {
    const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    return blocks.map((block) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const bodyLines: string[] = [];
        const options: { text: string; correct: boolean }[] = [];
        let answerLabels: string[] = [];
        let explanation = "";
        let answerText = "";
        const meta: Record<string, string> = {};
        lines.forEach((line, i) => {
            const key = KEY_RE.exec(line);
            const expl = EXPL_RE.exec(line);
            const m = META_RE.exec(line);
            if (key) {
                answerText = key[2].trim();
                answerLabels = key[2].split(/[,\s/&]+/).map((x) => x.trim().replace(/[.)]$/, "")).filter(Boolean);
                return;
            }
            if (expl) { explanation = expl[2].trim(); return; }
            if (m) { meta[m[1].toLowerCase()] = m[2].trim(); return; }
            const opt = i > 0 ? OPTION_RE.exec(line) : null;
            if (opt) {
                let t = opt[2].trim();
                let correct = false;
                if (/(\*|✓|✔)$/.test(t)) { correct = true; t = t.replace(/\s*(\*|✓|✔)$/, ""); }
                if (/^(\*|✓|✔)/.test(t)) { correct = true; t = t.replace(/^(\*|✓|✔)\s*/, ""); }
                options.push({ text: t, correct });
                return;
            }
            if (options.length > 0) options[options.length - 1].text += ` ${line}`;
            else bodyLines.push(i === 0 ? line.replace(/^(Q\s*\d*|\d+)\s*[.):\-]\s*/i, "") : line);
        });
        return buildDraft({
            body: bodyLines.join(" "),
            options,
            answerLabels,
            answerText,
            explanation,
            marks: meta.marks || meta.mark || meta["মার্ক"] ? Number(meta.marks || meta.mark || meta["মার্ক"]) : undefined,
            tag: meta.tag,
            difficulty: meta.difficulty,
            timeLimitSeconds: meta.time ? Number(meta.time) : null,
        });
    });
}

/** Rows from a CSV/XLSX sheet (objects keyed by header). */
export function parseSheetRows(rows: Record<string, unknown>[]): ParsedRow[] {
    return rows
        .map((raw) => {
            const r: Record<string, string> = {};
            for (const [k, v] of Object.entries(raw)) r[k.toLowerCase().replace(/[^a-z0-9ঀ-৿]/g, "")] = String(v ?? "").trim();
            const body = r.question || r.q || r["প্রশ্ন"] || "";
            const options: { text: string; correct: boolean }[] = [];
            for (let i = 0; i < 8; i++) {
                const letter = String.fromCharCode(97 + i);
                const text = r[`option${letter}`] ?? r[`option${i + 1}`] ?? r[letter] ?? r[`opt${letter}`] ?? "";
                if (text) options.push({ text, correct: false });
            }
            const typeRaw = (r.type || "").toLowerCase();
            const type: QuizQuestionType | undefined = typeRaw.includes("multi") ? "MULTI_CHOICE" : typeRaw.includes("true") ? "TRUE_FALSE" : typeRaw.includes("short") ? "SHORT_ANSWER" : typeRaw.includes("single") ? "SINGLE_CHOICE" : undefined;
            const correct = r.correct || r.answer || r.ans || r["উত্তর"] || "";
            return {
                body,
                skip: !body && options.length === 0,
                row: buildDraft({
                    body,
                    options,
                    answerLabels: correct.split(/[,;|/&\s]+/).filter(Boolean),
                    answerText: correct,
                    explanation: r.explanation || r["ব্যাখ্যা"] || "",
                    marks: r.marks ? Number(r.marks) : undefined,
                    tag: r.tag,
                    difficulty: r.difficulty,
                    timeLimitSeconds: r.time || r.timelimit ? Number(r.time || r.timelimit) : null,
                    type: type && type !== "TRUE_FALSE" ? type : undefined,
                }),
            };
        })
        .filter((x) => !x.skip)
        .map((x) => x.row);
}

export const CSV_TEMPLATE =
    "Question,Option A,Option B,Option C,Option D,Correct,Marks,Explanation,Tag,Difficulty\n" +
    "\"2 + 2 = ?\",3,4,5,6,B,1,\"Basic addition\",math,easy\n" +
    "\"Pick the primes\",2,4,5,9,\"A,C\",2,,math,medium\n";
