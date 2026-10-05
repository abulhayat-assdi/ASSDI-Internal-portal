"use client";

import { Check } from "lucide-react";

export const fieldClass =
    "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all";
export const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
export const btnPrimary =
    "cursor-pointer inline-flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-brand-600/20 transition-colors whitespace-nowrap";
export const btnGhost =
    "cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors font-medium";

/** Rendering of server-sanitized rich-text HTML (sanitized on save by the API). */
export function RichHtml({ html, className = "" }: { html: string; className?: string }) {
    return <div className={`prose prose-sm max-w-none ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer select-none">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`mt-0.5 relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-slate-300"}`}
            >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
            </button>
            <span>
                <span className="block text-sm font-medium text-slate-700">{label}</span>
                {hint && <span className="block text-xs text-slate-400">{hint}</span>}
            </span>
        </label>
    );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
    return (
        <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 gap-1">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${value === o.value ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function CheckToggle({ checked, onClick, round, title }: { checked: boolean; onClick: () => void; round?: boolean; title?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-pressed={checked}
            className={`cursor-pointer h-8 w-8 shrink-0 flex items-center justify-center border-2 transition-colors ${round ? "rounded-full" : "rounded-lg"} ${checked ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-400"}`}
        >
            <Check className="h-4 w-4" strokeWidth={3} />
        </button>
    );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="no-gradient text-lg font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Close">×</button>
                </div>
                {children}
            </div>
        </div>
    );
}
