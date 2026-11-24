"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/contexts/ConfirmContext";
import {
    gradeSubmission,
    type HomeworkAssignment,
    type HomeworkSubmission,
} from "@/services/homeworkService";
import { formatHomeworkSubmittedAt, getHomeworkFiles } from "@/lib/homeworkExport";
import { formatMarks, gradeStatus, MAX_FEEDBACK_LENGTH, parseMarks, viewerKind } from "@/lib/homeworkGrading";
import HomeworkFileViewer from "./HomeworkFileViewer";
import HomeworkCommentThread from "./HomeworkCommentThread";

interface Props {
    submissions: HomeworkSubmission[];
    initialId: string;
    assignment: HomeworkAssignment | null;
    canGrade: boolean;
    viewerUid?: string;
    onClose: () => void;
    onSubmissionUpdated: (sub: HomeworkSubmission) => void;
}

const KIND_ICON: Record<string, string> = {
    image: "🖼️", pdf: "📕", video: "🎬", audio: "🎵", office: "📄", text: "📝", html: "🌐", other: "📦",
};

/**
 * Full-screen, Google-Classroom-style review: pick any submitter from the
 * dropdown (or ← →), read their files inline, and mark/comment on the right.
 */
export default function HomeworkReviewWindow({
    submissions, initialId, assignment, canGrade, viewerUid, onClose, onSubmissionUpdated,
}: Props) {
    const confirm = useConfirm();
    const marksEnabled = !!assignment?.marksEnabled && !!assignment.totalMarks;
    const total = assignment?.totalMarks ?? 0;

    const [currentId, setCurrentId] = useState(initialId);
    const index = Math.max(0, submissions.findIndex((s) => s.id === currentId));
    const current = submissions[index];

    const [tab, setTab] = useState(0);
    const [marksDraft, setMarksDraft] = useState("");
    const [feedbackDraft, setFeedbackDraft] = useState("");
    const [saving, setSaving] = useState<null | "save" | "return" | "unreturn">(null);
    const [error, setError] = useState("");
    const [savedFlash, setSavedFlash] = useState(false);
    const [listOpen, setListOpen] = useState(false);
    const [listSearch, setListSearch] = useState("");
    const listRef = useRef<HTMLDivElement>(null);

    // Reset the form whenever another student is shown.
    useEffect(() => {
        if (!current) return;
        setMarksDraft(formatMarks(current.marks));
        setFeedbackDraft(current.feedback ?? "");
        setTab(0);
        setError("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current?.id]);

    // Lock page scroll behind the window.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, []);

    const dirty = !!current && canGrade && (
        (marksEnabled && marksDraft.trim() !== formatMarks(current.marks)) ||
        feedbackDraft.trim() !== (current.feedback ?? "").trim()
    );
    const marksCheck = useMemo(
        () => (marksEnabled ? parseMarks(marksDraft, total) : { ok: true as const, value: null }),
        [marksEnabled, marksDraft, total]
    );

    const save = useCallback(async (action: "save" | "return" | "unreturn"): Promise<boolean> => {
        if (!current) return false;
        if (!marksCheck.ok) { setError(marksCheck.error); return false; }
        setSaving(action);
        setError("");
        try {
            const updated = await gradeSubmission(current.id, {
                ...(marksEnabled ? { marks: marksCheck.value } : {}),
                feedback: feedbackDraft,
                action,
            });
            onSubmissionUpdated({ ...current, ...updated });
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1800);
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
            return false;
        } finally {
            setSaving(null);
        }
    }, [current, marksCheck, marksEnabled, feedbackDraft, onSubmissionUpdated]);

    /** Leaving a student: unsaved work is saved first, or explicitly discarded. */
    const leaveCurrent = useCallback(async (): Promise<boolean> => {
        if (!dirty) return true;
        if (marksCheck.ok && (await save("save"))) return true;
        return confirm({
            title: "সেভ হয়নি",
            message: "এই স্টুডেন্টের মার্কস/ফিডব্যাক সেভ করা যায়নি। পরিবর্তন বাদ দিয়ে যাবেন?",
            confirmText: "বাদ দিন",
            variant: "warning",
        });
    }, [dirty, marksCheck.ok, save, confirm]);

    const goTo = useCallback(async (id: string) => {
        if (id === currentId) return;
        if (await leaveCurrent()) {
            setCurrentId(id);
            setListOpen(false);
        }
    }, [currentId, leaveCurrent]);

    const close = useCallback(async () => {
        if (await leaveCurrent()) onClose();
    }, [leaveCurrent, onClose]);

    const prev = index > 0 ? submissions[index - 1] : null;
    const next = index < submissions.length - 1 ? submissions[index + 1] : null;

    // ← → switch student, Esc closes — but never while typing.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
            if (e.key === "ArrowLeft" && prev) { e.preventDefault(); goTo(prev.id); }
            else if (e.key === "ArrowRight" && next) { e.preventDefault(); goTo(next.id); }
            else if (e.key === "Escape") { if (listOpen) setListOpen(false); else close(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [prev, next, goTo, close, listOpen]);

    // Close the student list on an outside click.
    useEffect(() => {
        if (!listOpen) return;
        const onDown = (e: MouseEvent) => {
            if (listRef.current && !listRef.current.contains(e.target as Node)) setListOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [listOpen]);

    const files = useMemo(() => (current ? getHomeworkFiles(current) : []), [current]);
    const hasText = !!current?.textContent?.trim();
    const tabs = [
        ...files.map((f, i) => ({ key: `f${i}`, label: f.fileName || `File ${i + 1}`, icon: KIND_ICON[viewerKind(f.fileName)] })),
        ...(hasText ? [{ key: "text", label: "লেখা উত্তর", icon: "✍️" }] : []),
    ];

    // The tab index belongs to the previous student until the reset effect
    // runs, so clamp it: another student may have fewer files.
    const activeTab = tab < tabs.length ? tab : 0;

    const statusOf = (s: HomeworkSubmission) => gradeStatus(s, marksEnabled);
    const statusChip = (s: HomeworkSubmission) => {
        const st = statusOf(s);
        const marks = marksEnabled && s.marks !== null && s.marks !== undefined ? `${formatMarks(s.marks)}/${formatMarks(total)}` : null;
        if (st === "returned") return <span className="text-xs font-bold text-emerald-700">{marks ?? "Returned"} ✓</span>;
        if (st === "graded") return <span className="text-xs font-bold text-amber-600">{marks ?? "Feedback"} · Draft</span>;
        return <span className="text-xs text-gray-400">Not graded</span>;
    };

    const q = listSearch.trim().toLowerCase();
    const listed = q
        ? submissions.filter((s) => s.studentName.toLowerCase().includes(q) || s.studentRoll.toLowerCase().includes(q))
        : submissions;
    const gradedCount = submissions.filter((s) => statusOf(s) !== "not_graded").length;

    if (!current) return null;
    const status = statusOf(current);

    return (
        <div className="fixed inset-0 z-[110] bg-white flex flex-col animate-in fade-in duration-150">
            {/* ── Top bar ── */}
            <div className="h-14 shrink-0 border-b border-gray-200 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3">
                <button onClick={close} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-600 text-xl flex items-center justify-center shrink-0" title="Close (Esc)">✕</button>

                <div className="relative min-w-0" ref={listRef}>
                    <button
                        onClick={() => { setListOpen((o) => !o); setListSearch(""); }}
                        className="flex items-center gap-2 max-w-[60vw] sm:max-w-xs px-3 py-1.5 rounded-xl border-2 border-blue-600 hover:bg-blue-50 text-left"
                    >
                        <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center shrink-0 text-sm">
                            {current.studentName.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-gray-900 truncate">{current.studentName}</span>
                            <span className="block text-[11px] text-gray-500 truncate">Roll {current.studentRoll}</span>
                        </span>
                        <span className="text-gray-500 text-xs shrink-0">▾</span>
                    </button>
                    {listOpen && (
                        <div className="absolute left-0 top-full mt-1 w-[min(92vw,380px)] bg-white rounded-xl shadow-2xl border border-gray-200 z-20 flex flex-col max-h-[70vh]">
                            <div className="p-2 border-b border-gray-100">
                                <input
                                    autoFocus
                                    value={listSearch}
                                    onChange={(e) => setListSearch(e.target.value)}
                                    placeholder="নাম বা রোল দিয়ে খুঁজুন…"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div className="overflow-y-auto">
                                {listed.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">কেউ পাওয়া যায়নি।</p>}
                                {listed.map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => goTo(s.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 ${s.id === current.id ? "bg-blue-50" : ""}`}
                                    >
                                        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-black flex items-center justify-center shrink-0 text-sm">
                                            {s.studentName.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-gray-900 truncate">{s.studentName}</span>
                                            <span className="block text-[11px] text-gray-500 truncate">Roll {s.studentRoll} · {s.studentBatchName}</span>
                                        </span>
                                        <span className="shrink-0">{statusChip(s)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={() => prev && goTo(prev.id)} disabled={!prev} className="w-9 h-9 rounded-full hover:bg-gray-100 disabled:opacity-30 text-lg shrink-0" title="Previous (←)">‹</button>
                <button onClick={() => next && goTo(next.id)} disabled={!next} className="w-9 h-9 rounded-full hover:bg-gray-100 disabled:opacity-30 text-lg shrink-0" title="Next (→)">›</button>
                <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">{index + 1} / {submissions.length}</span>

                <div className="flex-1" />
                {canGrade && (
                    <span className="text-xs text-gray-500 hidden md:inline shrink-0">Graded {gradedCount}/{submissions.length}</span>
                )}
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${status === "returned" ? "bg-emerald-100 text-emerald-700" : status === "graded" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                    {status === "returned" ? "Returned" : status === "graded" ? "Not returned" : "Not graded"}
                </span>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
                {/* Viewer */}
                <div className="flex-1 min-h-[55vh] lg:min-h-0 flex flex-col bg-gray-100 min-w-0">
                    {tabs.length > 1 && (
                        <div className="flex gap-1 overflow-x-auto px-2 pt-2 bg-gray-100 shrink-0">
                            {tabs.map((t, i) => (
                                <button
                                    key={t.key}
                                    onClick={() => setTab(i)}
                                    className={`shrink-0 max-w-[220px] truncate px-3 py-1.5 rounded-t-lg text-xs font-semibold border border-b-0 ${activeTab === i ? "bg-white text-gray-900 border-gray-200" : "bg-gray-200/70 text-gray-600 border-transparent hover:bg-gray-200"}`}
                                    title={t.label}
                                >
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex-1 min-h-0 bg-white flex flex-col">
                        {tabs.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">কোনো ফাইল বা লেখা নেই।</div>
                        ) : tabs[activeTab]?.key === "text" ? (
                            <div className="flex-1 overflow-auto p-6">
                                <TextAnswer text={current.textContent ?? ""} />
                            </div>
                        ) : (
                            <HomeworkFileViewer
                                key={`${current.id}-${activeTab}`}
                                file={files[activeTab]}
                                fileIndex={activeTab}
                                submissionId={current.id}
                                studentUid={current.studentUid}
                            />
                        )}
                    </div>
                </div>

                {/* Grade & feedback */}
                <aside className="w-full lg:w-[360px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 overflow-y-auto bg-white">
                    <section className="p-5 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900">Grade and feedback</h3>
                        <p className="text-xs text-gray-500 mt-1">জমা: {formatHomeworkSubmittedAt(current)}</p>
                        <p className="text-xs text-gray-500">{current.studentBatchName} · Roll {current.studentRoll}</p>
                        {current.gradedByName && current.gradedAt && (
                            <p className="text-[11px] text-gray-400 mt-1">
                                শেষ গ্রেড: {current.gradedByName}, {new Date(current.gradedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                            </p>
                        )}
                    </section>

                    <section className="p-5 border-b border-gray-100 space-y-4">
                        {marksEnabled ? (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1.5">Marks</label>
                                <div className={`flex items-center border rounded-xl overflow-hidden ${marksCheck.ok ? "border-gray-300 focus-within:ring-2 focus-within:ring-emerald-500" : "border-red-400 ring-2 ring-red-100"}`}>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={marksDraft}
                                        onChange={(e) => setMarksDraft(e.target.value.replace(/[^\d.]/g, ""))}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save("save"); } }}
                                        disabled={!canGrade}
                                        placeholder="মার্কস দিন"
                                        className="flex-1 min-w-0 px-4 py-2.5 text-base outline-none disabled:bg-gray-50"
                                    />
                                    <span className="px-4 text-gray-500 font-semibold">/ {formatMarks(total)}</span>
                                </div>
                                {!marksCheck.ok && <p className="text-xs text-red-600 mt-1">{marksCheck.error}</p>}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                এই অ্যাসাইনমেন্টে মার্কস চালু নেই — শুধু ফিডব্যাক দেওয়া যাবে।{canGrade && assignment ? " (ফোল্ডার Edit করে মার্কস চালু করা যায়)" : ""}
                            </p>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1.5">Feedback <span className="font-normal text-gray-400 text-xs">(Return করলে স্টুডেন্ট দেখবে)</span></label>
                            <textarea
                                value={feedbackDraft}
                                onChange={(e) => setFeedbackDraft(e.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
                                disabled={!canGrade}
                                rows={4}
                                placeholder="ভালো দিক, কী উন্নতি করতে হবে…"
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-y disabled:bg-gray-50"
                            />
                        </div>

                        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

                        {canGrade ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => save("save")}
                                    disabled={!!saving || !dirty || !marksCheck.ok}
                                    className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                >
                                    {saving === "save" ? "Saving…" : "Save draft"}
                                </button>
                                {status !== "returned" || dirty ? (
                                    <button
                                        onClick={async () => { if (await save("return")) { if (next) setCurrentId(next.id); } }}
                                        disabled={!!saving || !marksCheck.ok}
                                        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40"
                                        title="সেভ করে স্টুডেন্টকে দেখাবে, তারপর পরের স্টুডেন্টে যাবে"
                                    >
                                        {saving === "return" ? "Returning…" : status === "returned" ? "Update & Return" : "Return"}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => save("unreturn")}
                                        disabled={!!saving}
                                        className="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100"
                                        title="স্টুডেন্ট আর মার্কস/ফিডব্যাক দেখতে পাবে না"
                                    >
                                        {saving === "unreturn" ? "…" : "Undo return"}
                                    </button>
                                )}
                                {savedFlash && <span className="text-xs font-bold text-emerald-600">✓ Saved</span>}
                            </div>
                        ) : (
                            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                শেয়ার করা ফোল্ডার — আপনি শুধু দেখতে পারবেন।
                            </p>
                        )}
                        {current.returnedAt && (
                            <p className="text-[11px] text-emerald-700">
                                Returned: {new Date(current.returnedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })} — স্টুডেন্ট দেখতে পাচ্ছে।
                            </p>
                        )}
                    </section>

                    <section className="p-5">
                        <h3 className="font-bold text-gray-900 mb-2">Private comments</h3>
                        <HomeworkCommentThread submissionId={current.id} viewerUid={viewerUid} />
                    </section>
                </aside>
            </div>
        </div>
    );
}

function TextAnswer({ text }: { text: string }) {
    const trimmed = text.trim();
    const isLink = /^https?:\/\/\S+$/i.test(trimmed);
    if (isLink) {
        return (
            <a href={trimmed} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all font-semibold">
                🔗 {trimmed}
            </a>
        );
    }
    return <div className="max-w-3xl mx-auto whitespace-pre-wrap text-gray-800 leading-relaxed">{text}</div>;
}
