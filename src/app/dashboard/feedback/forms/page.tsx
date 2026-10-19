"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useConfirm } from "@/contexts/ConfirmContext";
import * as feedbackService from "@/services/feedbackService";

export default function FeedbackFormsPage() {
    const confirm = useConfirm();
    const [forms, setForms] = useState<feedbackService.FeedbackForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setForms(await feedbackService.getFeedbackForms());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setCreating(true);
        try {
            await feedbackService.createFeedbackForm(title.trim(), description.trim() || undefined);
            setTitle("");
            setDescription("");
            toast.success("Feedback form opened.");
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create form.");
        } finally {
            setCreating(false);
        }
    };

    const handleToggle = async (f: feedbackService.FeedbackForm) => {
        setBusyId(f.id);
        try {
            await feedbackService.setFeedbackFormOpen(f.id, !f.isOpen);
            setForms((prev) => prev.map((x) => (x.id === f.id ? { ...x, isOpen: !f.isOpen } : x)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update form.");
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (f: feedbackService.FeedbackForm) => {
        const ok = await confirm({
            message: `Delete "${f.title}" and all ${f.total} feedback in it permanently?`,
            variant: "danger",
        });
        if (!ok) return;
        setBusyId(f.id);
        try {
            await feedbackService.deleteFeedbackForm(f.id);
            setForms((prev) => prev.filter((x) => x.id !== f.id));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete form.");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                <div>
                    <h1 className="text-3xl font-bold text-[#1f2937]">Feedback Forms</h1>
                    <p className="text-[#6b7280] mt-1">
                        Open a feedback form for one teacher, topic or facility — its answers stay in their own report.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                <Link href="/dashboard/feedback" className="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-500 hover:text-gray-700">
                    General
                </Link>
                <span className="px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-gray-900 shadow-sm">Forms</span>
            </div>

            <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <h2 className="text-lg font-semibold text-[#1f2937]">Open a new form</h2>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    placeholder="Question / topic, e.g. How was Rahim sir's Photoshop class?"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={1000}
                    rows={2}
                    placeholder="Optional details shown to students"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button
                    type="submit"
                    disabled={creating || !title.trim()}
                    className="px-4 py-2 bg-[#059669] text-white text-sm font-semibold rounded-lg hover:bg-[#10b981] disabled:opacity-60"
                >
                    {creating ? "Opening..." : "Open form"}
                </button>
            </form>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading forms...</div>
            ) : forms.length === 0 ? (
                <div className="text-center py-12 text-[#6b7280]">No feedback forms yet.</div>
            ) : (
                <div className="space-y-3">
                    {forms.map((f) => (
                        <div key={f.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-wrap items-center gap-4">
                            <div className="flex-1 min-w-[240px]">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-[#1f2937]">📁 {f.title}</h3>
                                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${f.isOpen ? "bg-[#d1fae5] text-[#059669]" : "bg-gray-100 text-gray-500"}`}>
                                        {f.isOpen ? "Open" : "Closed"}
                                    </span>
                                    {f.unread > 0 && (
                                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-600">
                                            {f.unread} unread
                                        </span>
                                    )}
                                </div>
                                {f.description && <p className="text-sm text-[#6b7280] mt-1">{f.description}</p>}
                                <p className="text-xs text-gray-400 mt-1">
                                    {f.total} response{f.total !== 1 ? "s" : ""} · opened {new Date(f.createdAt).toLocaleDateString("en-GB")}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/dashboard/feedback/forms/${f.id}`}
                                    className="px-4 py-2 bg-[#059669] text-white text-sm font-semibold rounded-lg hover:bg-[#10b981]"
                                >
                                    View report
                                </Link>
                                <button
                                    onClick={() => handleToggle(f)}
                                    disabled={busyId === f.id}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-60"
                                >
                                    {f.isOpen ? "Close" : "Reopen"}
                                </button>
                                <button
                                    onClick={() => handleDelete(f)}
                                    disabled={busyId === f.id}
                                    className="px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 disabled:opacity-60"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
