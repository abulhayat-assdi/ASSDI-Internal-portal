import { NextRequest } from "next/server";
import { linkAccess, customer } from "@/lib/live-chat/access";
import { failure } from "@/lib/live-chat/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const query = () =>
      linkAccess(req, token, async (tx, link) => {
        const session = await customer(
          tx,
          link.workspaceId,
          req.cookies.get("lc_" + link.id)?.value || "",
          link.id,
        );
        const chat = await tx.chatConversation.findFirst({
          where: {
            workspaceId: link.workspaceId,
            customerSessionId: session.id,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (!chat) return null;
        const row = await tx.chatEvent.findFirst({
          where: {
            workspaceId: link.workspaceId,
            conversationId: chat.id,
            type: { notIn: ["coach", "note", "evaluated"] },
          },
          orderBy: { id: "desc" },
          select: { id: true },
        });
        return row?.id || null;
      });
    await query();
    let cursor = BigInt(req.headers.get("last-event-id") || "0");
    let timer: ReturnType<typeof setTimeout>,
      stopped = false;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const stop = () => {
          stopped = true;
          clearTimeout(timer);
          try {
            controller.close();
          } catch {}
        };
        req.signal.addEventListener("abort", stop, { once: true });
        const poll = async () => {
          if (stopped) return;
          try {
            const id = await query();
            if (stopped) return;
            if (id && id > cursor) {
              cursor = id;
              controller.enqueue(
                encoder.encode(`id: ${id}\nevent: change\ndata: {}\n\n`),
              );
            } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            stop();
            return;
          }
          if (!stopped) timer = setTimeout(poll, 2000);
        };
        void poll();
      },
      cancel() {
        stopped = true;
        clearTimeout(timer);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
