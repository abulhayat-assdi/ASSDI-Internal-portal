"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface CvDraft {
    id: string;
    title: string;
    isPublic: boolean;
    shareSlug: string | null;
    downloadCount: number;
    updatedAt: string;
    template: { name: string } | null;
}

export default function CvListPage() {
    const router = useRouter();
    const [drafts, setDrafts] = useState<CvDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [sharingId, setSharingId] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/cv")
            .then((r) => r.json())
            .then((data) => setDrafts(Array.isArray(data) ? data : []))
            .catch(() => toast.error("Failed to load CVs"))
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = async (id: string) => {
        const res = await fetch(`/api/cv/${id}`, { method: "DELETE" });
        if (res.ok) {
            setDrafts((prev) => prev.filter((d) => d.id !== id));
            toast.success("CV deleted");
        } else {
            toast.error("Failed to delete CV");
        }
        setDeleteId(null);
    };

    const handleShareToggle = async (draft: CvDraft) => {
        setSharingId(draft.id);
        try {
            if (draft.isPublic) {
                const res = await fetch(`/api/cv/${draft.id}/share`, { method: "DELETE" });
                if (res.ok) {
                    setDrafts((prev) => prev.map((d) => d.id === draft.id ? { ...d, isPublic: false, shareSlug: null } : d));
                    toast.success("Share link removed");
                }
            } else {
                const res = await fetch(`/api/cv/${draft.id}/share`, { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                    setDrafts((prev) => prev.map((d) => d.id === draft.id ? { ...d, isPublic: true, shareSlug: data.shareSlug } : d));
                    const url = `${window.location.origin}/cv/${data.shareSlug}`;
                    await navigator.clipboard.writeText(url).catch(() => {});
                    toast.success("Share link created and copied!");
                }
            }
        } catch {
            toast.error("Failed to update share status");
        } finally {
            setSharingId(null);
        }
    };

    const copyShareLink = async (slug: string) => {
        const url = `${window.location.origin}/cv/${slug}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Link copied to clipboard");
    };

    const handleDownloadPdfDirectly = (id: string) => {
        window.open(`/api/cv/${id}/pdf`, "_blank");
        setDrafts((prev) =>
            prev.map((d) => (d.id === id ? { ...d, downloadCount: d.downloadCount + 1 } : d))
        );
    };

    const handleDownloadDocxDirectly = async (id: string, title: string) => {
        const toastId = toast.loading("Generating Word file...");
        try {
            const response = await fetch(`/api/cv/${id}/docx`);
            if (!response.ok) throw new Error("Failed to generate Word file");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${title.replace(/[^a-zA-Z0-9 _-]/g, "_")}_CV.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Word file downloaded!", { id: toastId });
            setDrafts((prev) =>
                prev.map((d) => (d.id === id ? { ...d, downloadCount: d.downloadCount + 1 } : d))
            );
        } catch (err) {
            console.error(err);
            toast.error("Failed to download Word file", { id: toastId });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]" />
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-4 sm:pb-12">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-[#059669] rounded-full" />
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#1f2937]">My CVs</h1>
                        <p className="text-[#6b7280] mt-1">Build and manage your professional CVs</p>
                    </div>
                </div>
                <Link
                    href="/student-dashboard/cv/new"
                    className="flex items-center gap-2 px-5 py-3 bg-[#059669] text-white rounded-xl font-bold text-sm hover:bg-[#047857] transition-all shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Create New CV
                </Link>
            </div>

            {/* Empty state */}
            {drafts.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-10 sm:p-12 text-center">
                    <div className="text-6xl mb-4">📄</div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">No CVs yet</h2>
                    <p className="text-gray-500 mb-6">Create your first professional CV in minutes.</p>
                    <Link
                        href="/student-dashboard/cv/new"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#059669] text-white rounded-xl font-bold hover:bg-[#047857] transition-all"
                    >
                        Get Started
                    </Link>
                </div>
            )}

            {/* CV Cards Grid */}
            {drafts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {drafts.map((draft) => (
                        <div key={draft.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                            {/* Card header */}
                            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5278] p-5 text-white">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="no-gradient font-bold text-lg truncate" style={{ color: "#ffffff" }}>{draft.template?.name ?? "Unknown template"}</h3>
                                        <p className="no-gradient text-sm mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{draft.title}</p>
                                    </div>
                                    {draft.isPublic && (
                                        <span className="flex-shrink-0 bg-green-400/20 text-green-200 text-xs font-bold px-2 py-1 rounded-full border border-green-300/30">
                                            Public
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Card body */}
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between text-sm text-gray-500">
                                    <span className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        {draft.downloadCount} download{draft.downloadCount !== 1 ? "s" : ""}
                                    </span>
                                    <span>{new Date(draft.updatedAt).toLocaleDateString()}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleDownloadPdfDirectly(draft.id)}
                                        className="flex items-center justify-center gap-1.5 py-2 px-3 border border-gray-200 text-gray-700 hover:text-white hover:bg-[#1e3a5f] hover:border-[#1e3a5f] rounded-xl text-xs font-bold min-h-10 transition-all cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        PDF
                                    </button>
                                    <button
                                        onClick={() => handleDownloadDocxDirectly(draft.id, draft.title)}
                                        className="flex items-center justify-center gap-1.5 py-2 px-3 border border-gray-200 text-gray-700 hover:text-white hover:bg-[#059669] hover:border-[#059669] rounded-xl text-xs font-bold min-h-10 transition-all cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Word
                                    </button>
                                </div>

                                {/* Share link copy */}
                                {draft.isPublic && draft.shareSlug && (
                                    <button
                                        onClick={() => copyShareLink(draft.shareSlug!)}
                                        className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-all"
                                    >
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy public link
                                    </button>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => router.push(`/student-dashboard/cv/${draft.id}/edit`)}
                                        className="flex-1 px-3 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-all text-center"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleShareToggle(draft)}
                                        disabled={sharingId === draft.id}
                                        className={`px-3 py-2.5 text-sm font-bold rounded-xl transition-all ${
                                            draft.isPublic
                                                ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                                                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                        }`}
                                    >
                                        {sharingId === draft.id ? "..." : draft.isPublic ? "Unshare" : "Share"}
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(draft.id)}
                                        className="px-3 py-2.5 bg-red-50 text-red-600 text-sm font-bold rounded-xl hover:bg-red-100 transition-all"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                        <div className="text-4xl mb-3">🗑️</div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this CV?</h3>
                        <p className="text-gray-500 text-sm mb-5">This action cannot be undone. All versions and data will be lost.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteId)}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
