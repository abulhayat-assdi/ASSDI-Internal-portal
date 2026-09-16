"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    subscribeToAllChatThreads,
    subscribeToChatMessages,
    sendChatMessage,
    deleteChatThread,
    markChatAsRead,
    AdminChatThread,
    ChatMessage,
    ChatAttachment
} from "@/services/contactService";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function ContactManagementPage() {
    const { user } = useAuth();
    const [threads, setThreads] = useState<AdminChatThread[]>([]);
    const [selectedThread, setSelectedThread] = useState<AdminChatThread | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [filter, setFilter] = useState<"all" | "unread" | "read" | "replied">("all");

    // isMobile: true = phone, false = desktop/tablet
    const [isMobile, setIsMobile] = useState(false);
    // showChat: on mobile, controls which panel is visible
    const [showChat, setShowChat] = useState(false);

    const [text, setText] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Detect mobile on mount + window resize (real-time)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check(); // run immediately on mount
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // When switching FROM desktop TO mobile, always reset to list view
    // so the user doesn't land in a broken half-state
    useEffect(() => {
        if (isMobile) {
            setShowChat(false);
        }
    }, [isMobile]);

    useEffect(() => {
        const unsub = subscribeToAllChatThreads((data) => {
            setThreads(data);
            // Auto-mark selected thread as read when new data arrives and still unread
            if (selectedThread) {
                const updated = data.find(t => t.studentUid === selectedThread.studentUid);
                if (updated && updated.unreadCountAdmin > 0) {
                    markChatAsRead(updated.studentUid, "admin");
                }
            }
        });
        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedThread?.studentUid]);

    // Subscribe to messages for selected thread
    useEffect(() => {
        if (!selectedThread) { setMessages([]); return; }
        const unsub = subscribeToChatMessages(selectedThread.studentUid, (msgs) => {
            setMessages(msgs);
            markChatAsRead(selectedThread.studentUid, "admin");
        });
        return unsub;
    }, [selectedThread]);


    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Select thread → on mobile, switch to chat panel + mark as read immediately
    const handleSelectThread = useCallback((thread: AdminChatThread) => {
        setSelectedThread(thread);
        if (thread.unreadCountAdmin > 0) {
            markChatAsRead(thread.studentUid, "admin");
            // Optimistic local update so badge clears instantly without waiting for SSE poll
            setThreads(prev => prev.map(t => t.studentUid === thread.studentUid ? { ...t, unreadCountAdmin: 0 } : t));
        }
        if (isMobile) setShowChat(true);
    }, [isMobile]);

    // Back button → return to list on mobile
    const handleBack = () => {
        setShowChat(false);
        // optionally clear: setSelectedThread(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const valid = Array.from(e.target.files).filter(f => f.size <= 10 * 1024 * 1024);
        if (valid.length < e.target.files.length) alert("Some files exceed 10MB and were skipped.");
        setFiles(prev => [...prev, ...valid]);
        e.target.value = "";
    };

    const formatTime = (ts: any) => {
        if (!ts) return "";
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const getInitials = (name = "") =>
        name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

    const handleSend = async () => {
        if (!selectedThread || (!text.trim() && files.length === 0)) return;
        setIsSending(true);
        try {
            const attachments: ChatAttachment[] = [];
            for (const file of files) {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("category", "chat_files");
                fd.append("path", selectedThread.studentUid);
                if (!user) throw new Error("Not authenticated");
                const res = await fetch("/api/storage/upload", {
                    method: "POST",
                    body: fd,
                });
                if (!res.ok) throw new Error("Upload failed");
                const data = await res.json();
                attachments.push({ url: `/api/file?path=${encodeURIComponent(data.storagePath)}`, name: file.name, path: data.storagePath, size: file.size, type: file.type });
            }
            await sendChatMessage(selectedThread.studentUid, "admin", text, attachments);

            // Optimistic update — show message instantly without waiting for SSE poll
            const sentText = text;
            const sentAttachments = attachments;
            setMessages(prev => [...prev, {
                id: `optimistic-${Date.now()}`,
                sender: "admin",
                text: sentText,
                attachments: sentAttachments,
                createdAt: new Date().toISOString(),
            }]);

            setText("");
            setFiles([]);
        } catch (err) {
            alert("Failed to send message.");
        } finally {
            setIsSending(false);
        }
    };

    const confirmDelete = async () => {
        if (!selectedThread) return;
        setIsDeleting(true);
        try {
            await deleteChatThread(selectedThread.studentUid);
            setSelectedThread(null);
            setShowDeleteModal(false);
            if (isMobile) setShowChat(false);
        } catch (err) {
            alert("Failed to delete: " + (err as any).message);
        } finally {
            setIsDeleting(false);
        }
    };

    // Filtered threads: unread = unreadCountAdmin>0, read = seen (unread==0), replied = lastSender admin
    const unreadCount = threads.filter(t => t.unreadCountAdmin > 0).length;
    const repliedCount = threads.filter(t => t.lastSender === "admin").length;
    const readCount = threads.filter(t => t.unreadCountAdmin === 0).length;

    const filteredThreads = threads.filter(t => {
        if (filter === "unread") return t.unreadCountAdmin > 0;
        if (filter === "read") return t.unreadCountAdmin === 0;
        if (filter === "replied") return t.lastSender === "admin";
        return true;
    });

    // ─────────────────────────────────────────────────────────────
    // Thread List Panel
    // ─────────────────────────────────────────────────────────────
    const renderListPanel = () => (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-bold text-gray-900 text-xl">Live Support</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Real-time messaging with students</p>
                    </div>
                    {threads.length > 0 && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full">
                            {threads.length}
                        </span>
                    )}
                </div>
                {/* Filters: unread / read / replied */}
                <div className="flex gap-1.5 mt-3">
                    {(["all", "unread", "read", "replied"] as const).map(f => {
                        const label = f === "all" ? "All" : f === "unread" ? "Unread" : f === "read" ? "Read" : "Replied";
                        const count = f === "all" ? threads.length : f === "unread" ? unreadCount : f === "read" ? readCount : repliedCount;
                        const active = filter === f;
                        return (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold border transition-colors ${
                                    active
                                        ? f === "unread" ? "bg-red-500 text-white border-red-500"
                                        : f === "replied" ? "bg-blue-600 text-white border-blue-600"
                                        : f === "read" ? "bg-gray-800 text-white border-gray-800"
                                        : "bg-emerald-600 text-white border-emerald-600"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                {label} <span className="opacity-70">({count})</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Thread items */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {filteredThreads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                        <div className="text-5xl mb-3">💬</div>
                        <p className="font-semibold text-gray-600">{threads.length === 0 ? "No active chats yet" : `No ${filter} messages`}</p>
                        <p className="text-sm text-gray-400 mt-1">{threads.length === 0 ? "Students&apos; messages will appear here" : "Try another filter"}</p>
                    </div>
                ) : (
                    filteredThreads.map(thread => {
                        const isActive = selectedThread?.studentUid === thread.studentUid;
                        return (
                            <button
                                key={thread.studentUid}
                                onClick={() => handleSelectThread(thread)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${
                                    isActive ? "bg-emerald-50" : "hover:bg-gray-50"
                                }`}
                            >
                                {/* Avatar */}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                    isActive ? "bg-[#059669] text-white" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                    {getInitials(thread.studentName)}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`font-bold text-sm truncate ${
                                            thread.unreadCountAdmin > 0 ? "text-gray-900" : "text-gray-700"
                                        }`}>
                                            {thread.studentName}
                                        </span>
                                        <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                                            {formatTime(thread.lastMessageTime)}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate mt-0.5 ${
                                        thread.unreadCountAdmin > 0 ? "font-semibold text-gray-700" : "text-gray-500"
                                    }`}>
                                        {thread.lastMessageText || "Sent an attachment"}
                                    </p>
                                </div>
                                {/* Unread badge */}
                                {thread.unreadCountAdmin > 0 && (
                                    <div className="w-5 h-5 bg-[#059669] rounded-full flex items-center justify-center shrink-0">
                                        <span className="text-[10px] text-white font-bold">
                                            {thread.unreadCountAdmin > 9 ? "9+" : thread.unreadCountAdmin}
                                        </span>
                                    </div>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────
    // Chat Panel
    // ─────────────────────────────────────────────────────────────
    const renderChatPanel = (withBack: boolean) => (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Header */}
            <div className="h-14 border-b border-gray-200 flex items-center justify-between px-3 bg-white shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    {withBack && (
                        <button
                            onClick={handleBack}
                            className="p-2 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                            aria-label="Back to chats"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                    )}
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                        {getInitials(selectedThread!.studentName)}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm leading-tight truncate">
                            {selectedThread!.studentName}
                        </p>
                        <p className="text-[11px] text-[#059669] font-medium truncate">
                            Roll: {selectedThread!.studentRoll} · Batch: {selectedThread!.studentBatchName}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#f0f4f3] flex flex-col gap-3">
                {messages.map((msg, idx) => {
                    const isAdmin = msg.sender === "admin";
                    return (
                        <div key={msg.id || idx} className={`flex max-w-[80%] ${isAdmin ? "self-end" : "self-start"}`}>
                            <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm ${
                                isAdmin
                                    ? "bg-[#1e3a5f] text-white rounded-tr-sm"
                                    : "bg-white text-gray-800 rounded-tl-sm border border-gray-100"
                            }`}>
                                {msg.text && (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                )}
                                {msg.attachments?.map((f, i) => (
                                    <Link
                                        key={i}
                                        href={f.url}
                                        target="_blank"
                                        className={`flex items-center gap-2 mt-1.5 p-2 rounded-xl border text-xs font-medium transition-colors ${
                                            isAdmin ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                                        }`}
                                    >
                                        <span>{f.type.includes("image") ? "🖼️" : "📄"}</span>
                                        <span className="truncate max-w-[140px]">{f.name}</span>
                                    </Link>
                                ))}
                                <p className={`text-[10px] mt-1 text-right ${isAdmin ? "text-blue-200" : "text-gray-400"}`}>
                                    {formatTime(msg.createdAt)}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-100 px-3 py-3 shrink-0">
                {files.length > 0 && (
                    <div className="flex gap-2 mb-2 overflow-x-auto">
                        {files.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 shrink-0">
                                <span className="text-sm">{f.type.includes("image") ? "🖼️" : "📄"}</span>
                                <span className="text-xs truncate max-w-[70px]">{f.name}</span>
                                <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 ml-1">✕</button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <div className="relative flex-1">
                        <textarea
                            key={selectedThread!.studentUid}
                            autoFocus
                            dir="ltr"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Write your reply..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-4 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/40 focus:border-[#059669] resize-none max-h-28"
                            rows={Math.min(4, (text.match(/\n/g)?.length ?? 0) + 1)}
                            disabled={isSending}
                        />
                        <label className="absolute right-3 bottom-3 cursor-pointer text-gray-400 hover:text-[#059669] transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <input type="file" multiple className="hidden" onChange={handleFileChange} disabled={isSending} />
                        </label>
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={isSending || (!text.trim() && files.length === 0)}
                        className="h-11 w-11 bg-[#1e3a5f] text-white rounded-2xl hover:bg-[#152e4d] transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
                    >
                        {isSending
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        }
                    </button>
                </div>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────
    // Empty state (desktop, no thread selected)
    // ─────────────────────────────────────────────────────────────
    const renderEmptyState = () => (
        <div className="flex-1 h-full flex flex-col items-center justify-center text-center opacity-40 bg-gray-50">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="font-bold text-gray-700 text-lg">Select a chat</h3>
            <p className="text-sm text-gray-500 mt-1">Choose a student from the sidebar to start</p>
        </div>
    );

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="h-[calc(100vh-5.5rem)] md:h-[calc(100vh-7.5rem)] flex flex-col">

            {/* Page title — only on desktop OR mobile list view */}
            {(!isMobile || !showChat) && (
                <div className="flex items-center gap-3 mb-4 shrink-0">
                    <div className="w-1 h-8 bg-[#059669] rounded-full" />
                    <div>
                        <h1 className="text-xl md:text-3xl font-bold text-[#1f2937]">Live Support</h1>
                        <p className="text-[#6b7280] text-xs md:text-sm">Real-time messaging with students</p>
                    </div>
                </div>
            )}

            {/* ── MOBILE ── */}
            {isMobile && (
                <div className="flex-1 min-h-0 rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white">
                    {!showChat
                        ? renderListPanel()
                        : selectedThread
                            ? renderChatPanel(true)
                            : renderListPanel()
                    }
                </div>
            )}

            {/* ── DESKTOP ── */}
            {!isMobile && (
                <div className="flex-1 min-h-0 flex rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white">
                    {/* Sidebar */}
                    <div className="w-80 shrink-0 border-r border-gray-200 overflow-hidden flex flex-col">
                        {renderListPanel()}
                    </div>
                    {/* Chat or empty */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {selectedThread ? renderChatPanel(false) : renderEmptyState()}
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowDeleteModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-7 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">⚠️</span>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Conversation?</h2>
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                This will <strong>permanently delete</strong> all messages and files for both parties. Cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={isDeleting}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-colors disabled:opacity-50"
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
// Build Fix: Thu May 14 09:29:35 AM +06 2026
