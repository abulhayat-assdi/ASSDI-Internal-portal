import { NextRequest } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/sse/chat/threads
 * SSE stream for all chat threads (admin only).
 * Replaces Firestore subscribeToAllChatThreads in contactService.
 */
export async function GET(request: NextRequest) {
    const user = await getSessionUser(request);
    if (!user || !isAdmin(user) || !user.courseId) {
        return new Response("Unauthorized", { status: 401 });
    }
    const courseId = user.courseId;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const send = async () => {
                try {
                    // Fresh transaction per poll tick — this stream stays open
                    // for a long time, so a single transaction for its whole
                    // lifetime would hold a pooled connection indefinitely.
                    const threads = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
                        tx.chatThread.findMany({
                            where: { courseId },
                            orderBy: { lastMessageTime: "desc" },
                        })
                    );

                    const data = JSON.stringify(
                        threads.map((t: any) => ({
                            studentUid: t.studentUid,
                            studentName: t.studentName,
                            studentEmail: t.studentEmail,
                            studentBatchName: t.studentBatchName,
                            studentRoll: t.studentRoll,
                            lastMessageText: t.lastMessageText,
                            lastMessageTime: t.lastMessageTime.toISOString(),
                            unreadCountAdmin: t.unreadCountAdmin,
                            unreadCountStudent: t.unreadCountStudent,
                        }))
                    );

                    controller.enqueue(encoder.encode(`event: threads\ndata: ${data}\n\n`));
                } catch (err) {
                    console.error("[SSE Chat Threads] Error:", err);
                }
            };

            send();
            const intervalId = setInterval(send, 5000);

            const pingId = setInterval(() => {
                controller.enqueue(encoder.encode(`: ping\n\n`));
            }, 25000);

            request.signal.addEventListener("abort", () => {
                clearInterval(intervalId);
                clearInterval(pingId);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
