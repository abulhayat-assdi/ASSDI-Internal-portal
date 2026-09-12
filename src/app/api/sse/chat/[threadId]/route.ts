import { NextRequest } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/sse/chat/[threadId]
 * SSE stream for messages in a specific student↔admin chat thread.
 * Replaces Firestore subscribeToChatMessages in contactService.
 *
 * threadId = studentUid (matching the ChatThread.studentUid field)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ threadId: string }> }
) {
    const user = await getSessionUser(request);
    if (!user || !user.courseId) {
        return new Response("Unauthorized", { status: 401 });
    }
    const courseId = user.courseId;

    const { threadId } = await params;

    // Students can only see their own thread
    if (user.role === "student" && user.id !== threadId) {
        return new Response("Forbidden", { status: 403 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const send = async () => {
                try {
                    // Fresh transaction per poll tick — this stream stays open
                    // for a long time, so a single transaction for its whole
                    // lifetime would hold a pooled connection indefinitely.
                    const data = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
                        // Find the thread first
                        const thread = await tx.chatThread.findUnique({
                            where: { studentUid: threadId, courseId },
                        });

                        if (!thread) {
                            return JSON.stringify([]);
                        }

                        const messages = await tx.chatMessage.findMany({
                            where: { threadId: thread.id, courseId },
                            orderBy: { createdAt: "asc" },
                            select: {
                                id: true,
                                sender: true,
                                text: true,
                                attachments: true,
                                createdAt: true,
                            },
                        });

                        // Always send full message list (client replaces state)
                        return JSON.stringify(
                            messages.map((m: any) => ({
                                id: m.id,
                                sender: m.sender,
                                text: m.text,
                                attachments: m.attachments,
                                createdAt: m.createdAt.toISOString(),
                            }))
                        );
                    });

                    controller.enqueue(encoder.encode(`event: messages\ndata: ${data}\n\n`));
                } catch (err) {
                    console.error("[SSE Chat] Error:", err);
                }
            };

            send();
            const intervalId = setInterval(send, 2000); // Poll every 2 seconds for chat (lower latency)

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
