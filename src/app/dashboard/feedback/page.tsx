"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import Card, { CardBody } from "@/components/ui/Card";
import { useConfirm } from "@/contexts/ConfirmContext";
import * as feedbackService from "@/services/feedbackService";
import type { FeedbackCategory } from "@/services/feedbackService";
import { formatDateShort } from "@/lib/utils";

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
    CourseContent: "Course Content",
    Teacher: "Teacher",
    Facilities: "Facilities",
    Administration: "Administration",
    Other: "Other",
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as FeedbackCategory[];

type ReadFilter = "unread" | "read" | "all";

export default function FeedbackPage() {
    const confirm = useConfirm();
    const [feedbackList, setFeedbackList] = useState<feedbackService.Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState<FeedbackCategory | "all">("all");
    const [readFilter, setReadFilter] = useState<ReadFilter>("all");
    const [runningOnly, setRunningOnly] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const loadFeedback = useCallback(async () => {
        setLoading(true);
        try {
            const data = await feedbackService.getFeedbackList({
                category: category === "all" ? undefined : category,
                isRead: readFilter === "all" ? undefined : readFilter === "read",
                allBatches: !runningOnly,
            });
            setFeedbackList(data);
        } finally {
            setLoading(false);
        }
    }, [category, readFilter, runningOnly]);

    useEffect(() => { loadFeedback(); }, [loadFeedback]);

    const handleToggleRead = async (id: string, isRead: boolean) => {
        setBusyId(id);
        try {
            await feedbackService.setFeedbackRead(id, isRead);
            setFeedbackList((prev) =>
                readFilter === "all"
                    ? prev.map((f) => (f.id === id ? { ...f, isRead } : f))
                    : prev.filter((f) => f.id !== id)
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update feedback.");
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({ message: "Delete this feedback permanently?", variant: "danger" });
        if (!ok) return;
        setBusyId(id);
        try {
            await feedbackService.deleteFeedback(id);
            setFeedbackList((prev) => prev.filter((f) => f.id !== id));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to delete feedback.");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                <div>
                    <h1 className="text-3xl font-bold text-[#1f2937]">Course Feedback</h1>
                    <p className="text-[#6b7280] mt-1">
                        Anonymous feedback from students — only batch and category are shown, never who wrote it.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FeedbackCategory | "all")}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                    <option value="all">All Categories</option>
                    {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                </select>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                    {(["unread", "read", "all"] as ReadFilter[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => setReadFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold capitalize transition-colors ${
                                readFilter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto cursor-pointer">
                    <input
                        type="checkbox"
                        checked={runningOnly}
                        onChange={(e) => setRunningOnly(e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    Running batches only
                </label>
            </div>

            {/* Feedback List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-[#1f2937]">Feedback</h2>
                    <span className="text-sm text-[#6b7280]">
                        {feedbackList.length} item{feedbackList.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading feedback...</div>
                ) : feedbackList.length > 0 ? (
                    <div className="space-y-4">
                        {feedbackList.map((fb) => (
                            <Card key={fb.id} className={`hover:shadow-lg transition-shadow ${!fb.isRead ? "ring-1 ring-[#059669]/30" : ""}`}>
                                <CardBody className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0">
                                            <svg className="w-8 h-8 text-[#d1d5db]" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                            </svg>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-4 flex-wrap">
                                                {fb.batchName && (
                                                    <span className="px-3 py-1 bg-[#059669] text-white text-sm font-semibold rounded-full">
                                                        {fb.batchName}
                                                    </span>
                                                )}
                                                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-semibold rounded-full">
                                                    {CATEGORY_LABELS[fb.category]}
                                                </span>
                                                <div className="flex text-yellow-400">
                                                    {[...Array(fb.rating || 5)].map((_, s) => (
                                                        <svg key={s} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    ))}
                                                </div>
                                                <span className="text-sm text-[#6b7280]">
                                                    📅 {fb.createdAt ? formatDateShort(new Date(fb.createdAt as any).toISOString()) : "N/A"}
                                                </span>
                                                <span
                                                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                                        fb.isRead ? "bg-gray-100 text-gray-500" : "bg-[#d1fae5] text-[#059669]"
                                                    }`}
                                                >
                                                    {fb.isRead ? "Read" : "Unread"}
                                                </span>
                                            </div>

                                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4">
                                                <p className="text-[#1f2937] leading-relaxed italic">&quot;{fb.message}&quot;</p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleToggleRead(fb.id, !fb.isRead)}
                                                    disabled={busyId === fb.id}
                                                    className="px-4 py-2 bg-[#059669] text-white text-sm font-semibold rounded-lg hover:bg-[#10b981] transition-colors disabled:opacity-60"
                                                >
                                                    {fb.isRead ? "Mark Unread" : "✓ Mark Read"}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(fb.id)}
                                                    disabled={busyId === fb.id}
                                                    className="px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60"
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 mx-auto text-[#d1d5db] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <p className="text-[#6b7280] text-lg">No feedback matches these filters</p>
                    </div>
                )}
            </div>
        </div>
    );
}
