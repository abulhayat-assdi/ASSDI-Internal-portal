"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Trash2, Plus, X, Library, Lock } from "lucide-react";
import RichTextEditor from "@/components/ui/RichTextEditor";
import {
    convertType, newOption, optionLabel, stripHtml, TYPE_LABEL, DIFFICULTIES,
    type LabelStyle, type QDraft, type QuizQuestionType,
} from "../types";
import { CheckToggle, RichHtml, fieldClass, labelClass } from "../ui";

type Props = {
    q: QDraft;
    index: number;
    total: number;
    style: LabelStyle;
    open: boolean;
    onToggle: () => void;
    onChange: (q: QDraft) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMove: (dir: -1 | 1) => void;
    onSaveToBank: () => Promise<void>;
};

const iconBtn = "cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default transition-colors";

export default function QuestionEditor({ q, index, total, style, open, onToggle, onChange, onDelete, onDuplicate, onMove, onSaveToBank }: Props) {
    const [banking, setBanking] = useState(false);
    const locked = Boolean(q.locked);
    const choice = q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE" || q.type === "TRUE_FALSE";
    const radio = q.type !== "MULTI_CHOICE";

    function toggleCorrect(id: string) {
        onChange({
            ...q,
            options: q.options.map((o) => (radio ? { ...o, isCorrect: o.id === id } : o.id === id ? { ...o, isCorrect: !o.isCorrect } : o)),
        });
    }

    async function saveBank() {
        setBanking(true);
        await onSaveToBank();
        setBanking(false);
    }

    const preview = stripHtml(q.bodyHtml) || "(খালি প্রশ্ন)";

    return (
        <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
            <div className="flex items-center gap-2 p-3">
                <button type="button" onClick={onToggle} className="cursor-pointer flex-1 min-w-0 flex items-center gap-3 text-left">
                    <span className="h-7 w-7 shrink-0 rounded-lg bg-brand-50 text-brand-700 text-sm font-bold flex items-center justify-center">{index + 1}</span>
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">{preview}</span>
                        <span className="block text-xs text-slate-400">{TYPE_LABEL[q.type]} · {q.marks} মার্ক{q.tag ? ` · #${q.tag}` : ""}</span>
                    </span>
                    {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                    {open ? <ChevronUp className="h-4 w-4 text-slate-400 ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 ml-auto shrink-0" />}
                </button>
                <div className="hidden sm:flex items-center">
                    <button type="button" className={iconBtn} disabled={index === 0 || locked} onClick={() => onMove(-1)} aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                    <button type="button" className={iconBtn} disabled={index === total - 1 || locked} onClick={() => onMove(1)} aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
                    <button type="button" className={iconBtn} onClick={onDuplicate} aria-label="Duplicate"><Copy className="h-4 w-4" /></button>
                    <button type="button" className={`${iconBtn} hover:!text-red-500`} disabled={locked} onClick={onDelete} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
            </div>

            {open && (
                <div className="border-t border-slate-100 p-4 space-y-4">
                    <div className="flex sm:hidden items-center gap-1 -mt-1">
                        <button type="button" className={iconBtn} disabled={index === 0 || locked} onClick={() => onMove(-1)}><ChevronUp className="h-4 w-4" /></button>
                        <button type="button" className={iconBtn} disabled={index === total - 1 || locked} onClick={() => onMove(1)}><ChevronDown className="h-4 w-4" /></button>
                        <button type="button" className={iconBtn} onClick={onDuplicate}><Copy className="h-4 w-4" /></button>
                        <button type="button" className={`${iconBtn} hover:!text-red-500`} disabled={locked} onClick={onDelete}><Trash2 className="h-4 w-4" /></button>
                    </div>

                    {locked ? (
                        <div className="space-y-3">
                            <RichHtml html={q.bodyHtml} />
                            {choice && (
                                <ul className="space-y-1.5">
                                    {q.options.map((o, i) => (
                                        <li key={o.id} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${o.isCorrect ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
                                            <b>{optionLabel(style, i)}.</b> <RichHtml html={o.textHtml} className="!m-0" />
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <p className="text-xs text-slate-400">এই প্রশ্ন লক করা — কুইজে অ্যাটেম্পট জমা পড়েছে।</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap gap-3">
                                <div className="w-full sm:w-auto">
                                    <label className={labelClass}>ধরন</label>
                                    <select value={q.type} onChange={(e) => onChange(convertType(q, e.target.value as QuizQuestionType))} className={fieldClass}>
                                        {(Object.keys(TYPE_LABEL) as QuizQuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className={labelClass}>মার্ক</label>
                                    <input type="number" min={0.5} step={0.5} value={q.marks} onChange={(e) => onChange({ ...q, marks: Number(e.target.value) })} className={fieldClass} />
                                </div>
                                <div className="w-32">
                                    <label className={labelClass}>Difficulty</label>
                                    <select value={q.difficulty} onChange={(e) => onChange({ ...q, difficulty: e.target.value })} className={fieldClass}>
                                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d || "—"}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1 min-w-[8rem]">
                                    <label className={labelClass}>Tag</label>
                                    <input value={q.tag} onChange={(e) => onChange({ ...q, tag: e.target.value })} className={fieldClass} placeholder="যেমন: Excel" />
                                </div>
                                <div className="w-36">
                                    <label className={labelClass}>লাইভ টাইমার (সে.)</label>
                                    <input type="number" min={5} value={q.timeLimitSeconds ?? ""} onChange={(e) => onChange({ ...q, timeLimitSeconds: e.target.value ? Number(e.target.value) : null })} className={fieldClass} placeholder="ডিফল্ট" />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>প্রশ্ন *</label>
                                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                                    <RichTextEditor value={q.bodyHtml} onChange={(html) => onChange({ ...q, bodyHtml: html })} placeholder="প্রশ্ন লিখুন..." />
                                </div>
                            </div>

                            {choice && (
                                <div>
                                    <label className={labelClass}>
                                        অপশন — {q.type === "MULTI_CHOICE" ? "একাধিক সঠিক উত্তর চিহ্নিত করা যাবে" : "একটি সঠিক উত্তর চিহ্নিত করুন"}
                                    </label>
                                    <div className="space-y-2">
                                        {q.options.map((o, i) => (
                                            <div key={o.id} className="flex items-start gap-2">
                                                <span className="mt-1.5 w-6 text-center text-sm font-bold text-slate-500">{optionLabel(style, i)}</span>
                                                <CheckToggle round={radio} checked={o.isCorrect} onClick={() => toggleCorrect(o.id)} title="সঠিক উত্তর" />
                                                <div className="flex-1 min-w-0 border border-slate-200 rounded-xl bg-white overflow-hidden">
                                                    {q.type === "TRUE_FALSE" ? (
                                                        <div className="px-3 py-2 text-sm"><RichHtml html={o.textHtml} className="!m-0" /></div>
                                                    ) : (
                                                        <RichTextEditor
                                                            value={o.textHtml}
                                                            placeholder={`অপশন ${optionLabel(style, i)}`}
                                                            onChange={(html) => onChange({ ...q, options: q.options.map((x) => (x.id === o.id ? { ...x, textHtml: html } : x)) })}
                                                        />
                                                    )}
                                                </div>
                                                {q.type !== "TRUE_FALSE" && (
                                                    <button type="button" disabled={q.options.length <= 2} onClick={() => onChange({ ...q, options: q.options.filter((x) => x.id !== o.id) })} className={`${iconBtn} mt-0.5`} aria-label="Remove option">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {q.type !== "TRUE_FALSE" && q.options.length < 8 && (
                                        <button type="button" onClick={() => onChange({ ...q, options: [...q.options, newOption()] })} className="cursor-pointer mt-2 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
                                            <Plus className="h-3.5 w-3.5" /> অপশন যোগ করুন
                                        </button>
                                    )}
                                </div>
                            )}
                            {q.type === "SHORT_ANSWER" && (
                                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">শর্ট আনসার ম্যানুয়ালি গ্রেড করতে হবে (রেজাল্ট পেজের Grading queue) এবং লাইভ কুইজে বাদ যায়।</p>
                            )}

                            <div>
                                <label className={labelClass}>ব্যাখ্যা (ঐচ্ছিক)</label>
                                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                                    <RichTextEditor value={q.explanationHtml} onChange={(html) => onChange({ ...q, explanationHtml: html })} placeholder="উত্তরের ব্যাখ্যা..." />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="flex justify-end">
                        <button type="button" disabled={banking} onClick={saveBank} className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 font-medium">
                            <Library className="h-3.5 w-3.5" /> {banking ? "সেভ হচ্ছে..." : "Question bank-এ সেভ করুন"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
