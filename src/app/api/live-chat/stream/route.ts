import { NextRequest } from "next/server";
import { chatIdentity, access } from "@/lib/live-chat/access";
import { failure } from "@/lib/live-chat/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const w = req.nextUrl.searchParams.get("workspaceId") || "";
    const ctx = await chatIdentity(req);
    await access(ctx, w, false, async () => true);
    let cursor = BigInt(
      req.headers.get("last-event-id") ||
        req.nextUrl.searchParams.get("after") ||
        "0",
    );
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
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
            const fresh = await chatIdentity(req);
            const next = await access(fresh, w, false, async (tx) => {
              const row = await tx.chatEvent.findFirst({
                where: { workspaceId: w, id: { gt: cursor } },
                orderBy: { id: "desc" },
                select: { id: true },
              });
              return row?.id;
            });
            if (stopped) return;
            // Only an invalidation cursor crosses the stream. Sensitive events/messages
            // are fetched through the authorized resource endpoints, never broadcast.
            if (next) {
              cursor = next;
              controller.enqueue(
                encoder.encode(`id: ${cursor}\nevent: change\ndata: {}\n\n`),
              );
            } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            if (!stopped)
              controller.enqueue(
                encoder.encode("event: revoked\ndata: {}\n\n"),
              );
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
