"use client";

import { useEffect, useState } from "react";
import { newOption, stripHtml, uid, TYPE_LABEL, DIFFICULTIES, type QDraft, type QuizQuestionType, type QOption } from "../types";
import { Modal, btnPrimary, fieldClass } from "../ui";

type BankItem = {
    id: string;
    type: QuizQuestionType;
    bodyHtml: string;
    marks: number;
    explanationHtml: string;
    tag: string | null;
    difficulty: string | null;
    options: QOption[];
};

export default function QuestionBankModal({ onClose, onAdd }: { onClose: () => void; onAdd: (qs: QDraft[]) => void }) {
    const [items, setItems] = useState<BankItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tag, setTag] = useState("");
    const [difficulty, setDifficulty] = useState("");
    const [picked, setPicked] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        const qs = new URLSearchParams();
        if (tag.trim()) qs.set("tag", tag.trim());
        if (difficulty) qs.set("difficulty", difficulty);
        const t = setTimeout(async () => {
            setLoading(true);
            const res = await fetch(`/api/quiz/question-bank?${qs}`);
            if (cancelled) return;
            if (res.ok) setItems(await res.json());
            else setError("Question bank লোড হয়নি");
            setLoading(false);
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
    }, [tag, difficulty]);

    function toggle(id: string) {
        setPicked((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    }

    function add() {
        const drafts: QDraft[] = items
            .filter((i) => picked.has(i.id))
            .map((i) => ({
                key: uid(),
                type: i.type,
                bodyHtml: i.bodyHtml,
                marks: i.marks,
                explanationHtml: i.explanationHtml,
                tag: i.tag ?? "",
                difficulty: i.difficulty ?? "",
                timeLimitSeconds: null,
                options: (i.options ?? []).map((o) => ({ ...newOption(o.textHtml, o.isCorrect) })),
                sourceBankItemId: i.id,
            }));
        onAdd(drafts);
        onClose();
    }

    return (
        <Modal title="Question bank থেকে যোগ করুন" onClose={onClose} wide>
            <div className="p-5 space-y-4">
                <div className="flex gap-3 flex-wrap">
                    <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag দিয়ে ফিল্টার" className={`${fieldClass} !w-48`} />
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`${fieldClass} !w-40`}>
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d || "সব difficulty"}</option>)}
                    </select>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {loading ? (
                    <div className="py-10 text-center"><div className="animate-spin rounded-full h-7 w-7 border-2 border-brand-600 border-t-transparent mx-auto" /></div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10">Bank-এ কোনো প্রশ্ন নেই।</p>
                ) : (
                    <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {items.map((i) => (
                            <label key={i.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50">
                                <input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} className="mt-1 h-4 w-4 accent-brand-600" />
                                <span className="min-w-0">
                                    <span className="block text-sm text-slate-800">{stripHtml(i.bodyHtml)}</span>
                                    <span className="block text-xs text-slate-400">{TYPE_LABEL[i.type]} · {i.marks} মার্ক{i.tag ? ` · #${i.tag}` : ""}{i.difficulty ? ` · ${i.difficulty}` : ""}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                )}
                <div className="flex justify-end">
                    <button type="button" disabled={picked.size === 0} onClick={add} className={btnPrimary}>{picked.size} টি প্রশ্ন যোগ করুন</button>
                </div>
            </div>
        </Modal>
    );
}
