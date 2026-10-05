"use client";

import { useState } from "react";
import { Plus, Upload, Library } from "lucide-react";
import toast from "react-hot-toast";
import { newQuestion, serializeQuestion, uid, validateQuestion, type LabelStyle, type QDraft } from "../types";
import QuestionEditor from "./QuestionEditor";
import BulkImportModal from "./BulkImportModal";
import QuestionBankModal from "./QuestionBankModal";

export default function QuestionBuilder({ questions, onChange, style }: { questions: QDraft[]; onChange: (qs: QDraft[]) => void; style: LabelStyle }) {
    const [openKey, setOpenKey] = useState<string | null>(null);
    const [modal, setModal] = useState<"import" | "bank" | null>(null);

    function add() {
        const q = newQuestion();
        onChange([...questions, q]);
        setOpenKey(q.key);
    }

    function addMany(qs: QDraft[]) {
        onChange([...questions, ...qs]);
        toast.success(`${qs.length} টি প্রশ্ন যোগ হয়েছে`);
    }

    function update(key: string, q: QDraft) {
        onChange(questions.map((x) => (x.key === key ? q : x)));
    }

    function move(i: number, dir: -1 | 1) {
        const j = i + dir;
        if (j < 0 || j >= questions.length) return;
        const next = [...questions];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    }

    function duplicate(i: number) {
        const src = questions[i];
        const copy: QDraft = {
            ...src,
            key: uid(),
            id: undefined,
            locked: false,
            options: src.options.map((o) => ({ ...o, id: uid() })),
        };
        const next = [...questions];
        next.splice(i + 1, 0, copy);
        onChange(next);
        setOpenKey(copy.key);
    }

    async function saveToBank(q: QDraft) {
        const err = validateQuestion(q);
        if (err) { toast.error(err); return; }
        const { timeLimitSeconds: _t, sourceBankItemId: _s, ...rest } = serializeQuestion(q);
        void _t; void _s;
        const res = await fetch("/api/quiz/question-bank", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rest),
        });
        if (res.ok) toast.success("Question bank-এ সেভ হয়েছে");
        else toast.error((await res.json().catch(() => ({}))).error || "সেভ হয়নি");
    }

    return (
        <div className="space-y-3">
            {questions.length === 0 && <p className="text-sm text-slate-400 text-center py-8">এখনো কোনো প্রশ্ন নেই — নিচের বাটন দিয়ে যোগ করুন।</p>}
            {questions.map((q, i) => (
                <QuestionEditor
                    key={q.key}
                    q={q}
                    index={i}
                    total={questions.length}
                    style={style}
                    open={openKey === q.key}
                    onToggle={() => setOpenKey(openKey === q.key ? null : q.key)}
                    onChange={(nq) => update(q.key, nq)}
                    onDelete={() => { if (confirm("প্রশ্নটি মুছে ফেলবেন?")) onChange(questions.filter((x) => x.key !== q.key)); }}
                    onDuplicate={() => duplicate(i)}
                    onMove={(d) => move(i, d)}
                    onSaveToBank={() => saveToBank(q)}
                />
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={add} className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold"><Plus className="h-4 w-4" /> প্রশ্ন যোগ করুন</button>
                <button type="button" onClick={() => setModal("import")} className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"><Upload className="h-4 w-4" /> বাল্ক ইম্পোর্ট</button>
                <button type="button" onClick={() => setModal("bank")} className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"><Library className="h-4 w-4" /> Question bank</button>
            </div>
            {modal === "import" && <BulkImportModal onClose={() => setModal(null)} onAdd={addMany} />}
            {modal === "bank" && <QuestionBankModal onClose={() => setModal(null)} onAdd={addMany} />}
        </div>
    );
}
