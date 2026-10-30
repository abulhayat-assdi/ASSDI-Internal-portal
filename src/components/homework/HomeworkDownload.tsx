"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { HomeworkSubmission } from "@/services/homeworkService";
import { createHomeworkZip, downloadHomeworkExcel, saveHomeworkZip } from "@/lib/homeworkExport";

export default function HomeworkDownload({ title, submissions }: {
    title: string;
    submissions: HomeworkSubmission[];
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<AbortController | null>(null);
    const menuId = useId();

    useEffect(() => () => { activeRef.current?.abort(); }, []);

    useEffect(() => {
        if (!open) return;
        menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        const closeOutside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", closeOutside);
        return () => document.removeEventListener("pointerdown", closeOutside);
    }, [open]);

    const download = async (format: "excel" | "zip") => {
        if (activeRef.current || !submissions.length) return;
        const controller = new AbortController();
        activeRef.current = controller;
        setOpen(false);
        setBusy(true);
        setError("");
        setProgress(format === "zip" ? "Preparing ZIP..." : "Preparing Excel...");
        try {
            if (format === "excel") {
                await downloadHomeworkExcel(title, submissions, controller.signal);
            } else {
                const blob = await createHomeworkZip(submissions, {
                    signal: controller.signal,
                    onProgress: message => { if (!controller.signal.aborted) setProgress(message); },
                });
                controller.signal.throwIfAborted();
                saveHomeworkZip(blob, title);
            }
            if (!controller.signal.aborted) setProgress("Download started.");
        } catch (err) {
            if (!controller.signal.aborted) {
                setError(err instanceof Error ? err.message : "Download failed. Please try again.");
                setProgress("");
            }
        } finally {
            if (activeRef.current === controller) activeRef.current = null;
            if (!controller.signal.aborted) {
                setBusy(false);
                buttonRef.current?.focus();
            }
        }
    };

    return (
        <div ref={rootRef} className="relative max-w-full w-full sm:w-auto"
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
            onKeyDown={event => {
                if (event.key === "Escape" && open) {
                    event.preventDefault();
                    setOpen(false);
                    buttonRef.current?.focus();
                }
            }}>
            <div className="flex items-center gap-2">
                <button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
                    onClick={() => setOpen(value => !value)}
                    onKeyDown={event => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            setOpen(true);
                        }
                    }}
                    disabled={busy || submissions.length === 0}
                    className="px-3 py-1 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    {busy ? "Downloading..." : "Download"}
                    <span aria-hidden="true">▾</span>
                </button>
                {busy && <button type="button" className="text-sm underline text-white"
                    onClick={() => {
                        activeRef.current?.abort();
                        activeRef.current = null;
                        setBusy(false);
                        setProgress("Download cancelled.");
                        buttonRef.current?.focus();
                    }}>Cancel</button>}
            </div>
            {open && (
                <div ref={menuRef} id={menuId} role="menu" aria-label="Download homework"
                    className="absolute left-0 top-full mt-2 w-60 max-w-[calc(100vw-4rem)] rounded-xl bg-white text-gray-800 shadow-xl border border-gray-200 p-1.5 z-30"
                    onKeyDown={event => {
                        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
                        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
                            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
                        buttons[next]?.focus();
                    }}>
                    <button type="button" role="menuitem" onClick={() => void download("excel")}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none">
                        Download Excel
                    </button>
                    <button type="button" role="menuitem" onClick={() => void download("zip")}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none">
                        Download ZIP
                        <span className="block text-xs font-normal text-gray-500 mt-0.5">(With uploaded file)</span>
                    </button>
                    <p className="px-3 py-1.5 text-xs text-gray-500 border-t border-gray-100">ZIP: up to 250 MB per download.</p>
                </div>
            )}
            {progress && <p role="status" className="mt-2 text-xs text-emerald-50">{progress}</p>}
            {error && <p role="alert" className="mt-2 max-w-lg rounded-lg bg-white px-3 py-2 text-sm text-red-700 break-words">{error}</p>}
        </div>
    );
}
