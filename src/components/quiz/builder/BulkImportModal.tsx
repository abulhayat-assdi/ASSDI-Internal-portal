"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, ClipboardPaste, Download } from "lucide-react";
import { stripHtml, TYPE_LABEL, type QDraft } from "../types";
import { Modal, btnPrimary, fieldClass } from "../ui";
import { CSV_TEMPLATE, parsePastedText, parseSheetRows, type ParsedRow } from "./importParse";

const PASTE_HINT = `1. বাংলাদেশের রাজধানী কোনটি?
A. ঢাকা *
B. চট্টগ্রাম
C. সিলেট
Explanation: ঢাকা রাজধানী
Marks: 1

2. Select the prime numbers
A. 2
B. 4
C. 5
Answer: A, C`;

export default function BulkImportModal({ onClose, onAdd }: { onClose: () => void; onAdd: (qs: QDraft[]) => void }) {
    const [tab, setTab] = useState<"paste" | "file">("paste");
    const [text, setText] = useState("");
    const [rows, setRows] = useState<ParsedRow[] | null>(null);
    const [err, setErr] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    async function onFile(file: File) {
        setErr("");
        try {
            const XLSX = await import("xlsx");
            const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
            const parsed = parseSheetRows(json);
            if (parsed.length === 0) setErr("ফাইলে কোনো প্রশ্ন পাওয়া যায়নি — হেডার (Question, Option A…) ঠিক আছে কিনা দেখুন।");
            setRows(parsed);
        } catch {
            setErr("ফাইলটি পড়া যায়নি।");
        }
    }

    function downloadTemplate() {
        const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "quiz-template.csv";
        a.click();
        URL.revokeObjectURL(a.href);
    }

    const valid = rows?.filter((r) => !r.error) ?? [];

    return (
        <Modal title="বাল্ক ইম্পোর্ট" onClose={onClose} wide>
            <div className="p-5 space-y-4">
                {!rows ? (
                    <>
                        <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
                            {([["paste", "টেক্সট পেস্ট", ClipboardPaste], ["file", "CSV / Excel", FileSpreadsheet]] as const).map(([k, label, Icon]) => (
                                <button key={k} type="button" onClick={() => setTab(k)} className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium ${tab === k ? "bg-brand-600 text-white" : "text-slate-500"}`}>
                                    <Icon className="h-4 w-4" /> {label}
                                </button>
                            ))}
                        </div>
                        {tab === "paste" ? (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-500">প্রতিটি প্রশ্ন ফাঁকা লাইন দিয়ে আলাদা করুন। সঠিক অপশনের শেষে <b>*</b> দিন অথবা <b>Answer: B</b> লিখুন।</p>
                                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className={`${fieldClass} font-mono`} placeholder={PASTE_HINT} />
                                <button type="button" disabled={!text.trim()} onClick={() => setRows(parsePastedText(text))} className={btnPrimary}>প্রিভিউ দেখুন</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-500">কলাম: <b>Question, Option A…F, Correct</b> (যেমন B বা &quot;A,C&quot;), এবং ঐচ্ছিক <b>Marks, Explanation, Tag, Difficulty, Type</b>।</p>
                                <button type="button" onClick={downloadTemplate} className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-brand-600 font-medium"><Download className="h-4 w-4" /> টেমপ্লেট ডাউনলোড</button>
                                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700 file:font-medium" />
                            </div>
                        )}
                        {err && <p className="text-sm text-red-600">{err}</p>}
                    </>
                ) : (
                    <>
                        <p className="text-sm text-slate-600">
                            <b className="text-emerald-600">{valid.length}</b> টি ঠিক আছে{rows.length - valid.length > 0 && <>, <b className="text-red-600">{rows.length - valid.length}</b> টিতে সমস্যা (বাদ যাবে)</>}।
                        </p>
                        <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {rows.map((r, i) => (
                                <div key={i} className={`p-3 text-sm ${r.error ? "bg-red-50/60" : ""}`}>
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold text-slate-400">{i + 1}.</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-slate-800">{stripHtml(r.draft.bodyHtml) || "—"}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {TYPE_LABEL[r.draft.type]} · {r.draft.marks} মার্ক
                                                {r.draft.options.length > 0 && <> · {r.draft.options.map((o, j) => `${String.fromCharCode(65 + j)}${o.isCorrect ? "✓" : ""}`).join(" ")}</>}
                                            </p>
                                            {r.error && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setRows(null)} className="cursor-pointer px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium">পিছনে</button>
                            <button type="button" disabled={valid.length === 0} onClick={() => { onAdd(valid.map((r) => r.draft)); onClose(); }} className={btnPrimary}>{valid.length} টি প্রশ্ন যোগ করুন</button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
