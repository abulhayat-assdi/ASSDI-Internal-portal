import { NextRequest } from "next/server";
import { chatIdentity, access, need } from "@/lib/live-chat/access";
import { report, conversation } from "@/lib/live-chat/service";
import { spreadsheet, reportPdf, transcriptPdf } from "@/lib/live-chat/export";
import { failure } from "@/lib/live-chat/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const ctx = await chatIdentity(req),
      q = req.nextUrl.searchParams,
      w = q.get("workspaceId") || "",
      format = q.get("format") || "xlsx";
    const payload = await access(ctx, w, false, async (tx) => {
      if (q.get("id")) {
        const c = await conversation(tx, w, q.get("id")!);
        need(
          ctx.staff ||
            c.agentId === ctx.user.id ||
            (await tx.chatAssignment.findFirst({
              where: {
                workspaceId: w,
                conversationId: c.id,
                agentId: ctx.user.id,
              },
            })),
          "Transcript access denied",
        );
        const messages = await tx.chatMessage.findMany({
          where: { workspaceId: w, conversationId: c.id },
          orderBy: { sequence: "asc" },
          take: 10001,
        });
        need(messages.length <= 10000, "Transcript too large", 413);
        return { transcript: { c, messages } };
      }
      return { data: await report(tx, ctx, w, q) };
    });
    // Rendering happens after the scoped transaction releases its DB connection.
    const result =
      "transcript" in payload && payload.transcript
        ? {
            buffer: await transcriptPdf(
              payload.transcript.c,
              payload.transcript.messages,
            ),
            pdf: true,
          }
        : {
            buffer:
              format === "pdf"
                ? await reportPdf(payload.data!)
                : await spreadsheet(payload.data!),
            pdf: format === "pdf",
          };
    return new Response(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.pdf
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="live-chat-${q.get("id") ? "transcript" : "report"}.${result.pdf ? "pdf" : "xlsx"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
