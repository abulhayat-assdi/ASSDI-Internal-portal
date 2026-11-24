"use client";

import { useEffect, useRef, useState } from "react";
import { getHomeworkComments, postHomeworkComment, type HomeworkComment } from "@/services/homeworkService";
import { MAX_COMMENT_LENGTH } from "@/lib/homeworkGrading";

interface Props {
    submissionId: string;
    viewerUid?: string;
    /** called with the new count after loading or posting */
    onCount?: (count: number) => void;
    compact?: boolean;
}

const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
        timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
    });

/** Private teacher ↔ student thread on one submission. */
export default function HomeworkCommentThread({ submissionId, viewerUid, onCount, compact }: Props) {
    const [comments, setComments] = useState<HomeworkComment[] | null>(null);
    const [canPost, setCanPost] = useState(false);
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState("");
    const listRef = useRef<HTMLDivElement>(null);
    const onCountRef = useRef(onCount);
    onCountRef.current = onCount;

    useEffect(() => {
        let cancelled = false;
        setComments(null);
        setDraft("");
        setError("");
        getHomeworkComments(submissionId)
            .then((r) => {
                if (cancelled) return;
                setComments(r.comments);
                setCanPost(r.canPost);
                onCountRef.current?.(r.comments.length);
            })
            .catch((e) => { if (!cancelled) { setComments([]); setError(e instanceof Error ? e.message : "Failed"); } });
        return () => { cancelled = true; };
    }, [submissionId]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [comments]);

    const post = async () => {
        const text = draft.trim();
        if (!text || posting) return;
        setPosting(true);
        setError("");
        try {
            const created = await postHomeworkComment(submissionId, text);
            setComments((prev) => {
                const next = [...(prev ?? []), created];
                onCountRef.current?.(next.length);
                return next;
            });
            setDraft("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className="space-y-2">
            {comments === null ? (
                <p className="text-xs text-gray-400">Loading comments…</p>
            ) : comments.length === 0 ? (
                <p className="text-xs text-gray-400 italic">এখনো কোনো কমেন্ট নেই।</p>
            ) : (
                <div ref={listRef} className={`space-y-2 overflow-y-auto pr-1 ${compact ? "max-h-48" : "max-h-72"}`}>
                    {comments.map((c) => {
                        const mine = c.authorUid === viewerUid;
                        const staff = c.authorRole !== "student";
                        return (
                            <div key={c.id} className={`rounded-xl px-3 py-2 text-sm border ${mine ? "bg-emerald-50 border-emerald-100 ml-4" : staff ? "bg-blue-50 border-blue-100 mr-4" : "bg-gray-50 border-gray-100 mr-4"}`}>
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-bold text-gray-800 text-xs truncate">
                                        {c.authorName}{staff ? " · Teacher" : ""}
                                    </span>
                                    <span className="text-[10px] text-gray-400 shrink-0">{formatTime(c.createdAt)}</span>
                                </div>
                                <p className="text-gray-700 whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
                            </div>
                        );
                    })}
                </div>
            )}
            {canPost && (
                <div className="space-y-1.5">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); post(); } }}
                        placeholder="প্রাইভেট কমেন্ট লিখুন…"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-400">Ctrl+Enter = Post</span>
                        <button
                            type="button"
                            onClick={post}
                            disabled={posting || !draft.trim()}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {posting ? "Posting…" : "Post"}
                        </button>
                    </div>
                </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}
