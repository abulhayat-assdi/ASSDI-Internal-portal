// ============================================================================
// CHAT SYSTEM — SSE-based (replaces Firestore onSnapshot)
// ============================================================================

export interface ChatAttachment {
    url: string;
    name: string;
    path: string;
    size: number;
    type: string;
}

export interface ChatMessage {
    id: string;
    sender: "student" | "admin";
    text: string;
    attachments: ChatAttachment[];
    createdAt: string;
}

export interface AdminChatThread {
    studentUid: string;
    studentName: string;
    studentEmail: string;
    studentBatchName: string;
    studentRoll: string;
    lastMessageText: string;
    lastMessageTime: string;
    unreadCountAdmin: number;
    unreadCountStudent: number;
    lastSender?: "student" | "admin" | null;
}

export const sendChatMessage = async (
    studentUid: string,
    sender: "student" | "admin",
    text: string,
    attachments: ChatAttachment[],
    studentProfileInfo?: { name: string; email: string; batch: string; roll: string }
): Promise<void> => {
    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentUid, sender, text, attachments, studentProfileInfo }),
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send message.");
    }
};

/**
 * SSE subscription for admin: all chat threads (replaces onSnapshot on 'admin_chats')
 */
export const subscribeToAllChatThreads = (callback: (threads: AdminChatThread[]) => void): (() => void) => {
    const controller = new AbortController();

    const connect = () => {
        const es = new EventSource("/api/sse/chat/threads");

        es.addEventListener("threads", (e) => {
            try {
                callback(JSON.parse(e.data));
            } catch { /* ignore */ }
        });

        es.onerror = () => {
            es.close();
            if (!controller.signal.aborted) setTimeout(connect, 5000);
        };

        controller.signal.addEventListener("abort", () => es.close());
    };

    connect();
    return () => controller.abort();
};

/**
 * SSE subscription for messages in a specific chat thread
 */
export const subscribeToChatMessages = (studentUid: string, callback: (messages: ChatMessage[]) => void): (() => void) => {
    const controller = new AbortController();

    const connect = () => {
        const es = new EventSource(`/api/sse/chat/${encodeURIComponent(studentUid)}`);

        es.addEventListener("messages", (e) => {
            try {
                callback(JSON.parse(e.data));
            } catch { /* ignore */ }
        });

        es.onerror = () => {
            es.close();
            if (!controller.signal.aborted) setTimeout(connect, 5000);
        };

        controller.signal.addEventListener("abort", () => es.close());
    };

    connect();
    return () => controller.abort();
};

export const markChatAsRead = async (studentUid: string, role: "student" | "admin"): Promise<void> => {
    await fetch("/api/chat/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentUid, role }),
    });
};

export const deleteChatThread = async (studentUid: string): Promise<void> => {
    const res = await fetch(`/api/chat?studentUid=${encodeURIComponent(studentUid)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete chat thread.");
};
