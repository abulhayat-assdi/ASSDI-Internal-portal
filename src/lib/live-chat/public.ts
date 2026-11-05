import "server-only";
import { z } from "zod";
import { NextRequest } from "next/server";
import { linkAccess, customer, hash, need } from "./access";
import { config, send } from "./service";
import { businessOpen, closed, settingsSchema } from "./domain";
import { getClientIp } from "@/lib/rateLimit";
import {
  lock,
  dispatch,
  event,
  finishAssignments,
} from "../../../scripts/lib/live-chat-engine.cjs";
import type { Tx } from "@/lib/customer-service/db";
import { createHmac } from "node:crypto";
function settingsPolicy(
  value: unknown,
  fallback: ReturnType<typeof settingsSchema.parse>,
) {
  return settingsSchema.parse({
    ...fallback,
    ...(value && typeof value === "object" ? value : {}),
  });
}

async function throttle(
  tx: Tx,
  s: { courseId: string; workspaceId: string },
  key: string,
  limit: number,
) {
  const id = hash(
    s.courseId + s.workspaceId + key + Math.floor(Date.now() / 60000),
  );
  const bucket = await tx.chatRateBucket.upsert({
    where: { id },
    create: { ...s, id, expiresAt: new Date(Date.now() + 120000) },
    update: { count: { increment: 1 } },
  });
  // A rejected mutation must commit this counter, so callers return a tagged result.
  return bucket.count <= limit;
}
export async function publicRead(req: NextRequest, token: string) {
  const kind = req.nextUrl.searchParams.get("kind") || "welcome";
  return linkAccess(
    req,
    token,
    async (tx, link, training) => {
      const settings = await config(tx, link.workspaceId);
      if (kind === "welcome")
        return {
          categories: await tx.chatCategory.findMany({
            where: { workspaceId: link.workspaceId, active: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
          training: true,
          accepting: link && businessOpen(settings),
          feedback: settings.feedback,
          scenario: training?.scenario || "",
        };
      const session = await customer(
        tx,
        link.workspaceId,
        req.cookies.get("lc_" + link.id)?.value || "",
        link.id,
      );
      const c = await tx.chatConversation.findFirst({
        where: { workspaceId: link.workspaceId, customerSessionId: session.id },
        orderBy: { createdAt: "desc" },
      });
      need(c, "Conversation not found", 404);
      const before = req.nextUrl.searchParams.get("before"),
        after = req.nextUrl.searchParams.get("after"),
        cursor = before || after;
      if (cursor)
        need(
          await tx.chatMessage.findFirst({
            where: {
              workspaceId: link.workspaceId,
              id: cursor,
              conversationId: c.id,
              kind: "MESSAGE",
            },
          }),
          "Invalid message cursor",
          404,
        );
      const messages = await tx.chatMessage.findMany({
        where: {
          workspaceId: link.workspaceId,
          conversationId: c.id,
          kind: "MESSAGE",
        },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { sequence: after ? "asc" : "desc" },
        take: 101,
        select: {
          id: true,
          sequence: true,
          text: true,
          sender: true,
          senderName: true,
          createdAt: true,
          requestId: true,
        },
      });
      const ahead =
        c.status === "QUEUED"
          ? await tx.chatConversation.count({
              where: {
                workspaceId: link.workspaceId,
                status: "QUEUED",
                queueAt: { lt: c.queueAt },
              },
            })
          : 0;
      return {
        conversation: {
          id: c.id,
          status: c.status,
          customerName: c.customerName,
          agentJoined: !!c.acceptedAt,
          firstReplyAt: c.firstReplyAt,
          agentTypingAt: c.agentTypingAt,
          agentReadAt: c.agentReadAt,
          feedback: c.feedback,
          resolution: c.resolution,
        },
        messages: after
          ? messages.slice(0, 100)
          : messages.slice(0, 100).reverse(),
        hasMore: messages.length > 100,
        queuePosition: ahead + 1,
        feedback: settings.feedback,
      };
    },
    kind === "welcome",
  );
}
export async function publicMutate(
  req: NextRequest,
  token: string,
  raw: unknown,
) {
  const b = z
    .object({
      action: z.enum([
        "start",
        "message",
        "read",
        "typing",
        "heartbeat",
        "close",
        "reopen",
        "feedback",
      ]),
      data: z.unknown().optional(),
    })
    .parse(raw);
  return linkAccess(
    req,
    token,
    async (tx, link, training) => {
      const s = { courseId: link.courseId, workspaceId: link.workspaceId },
        cfg = await config(tx, s.workspaceId),
        now = new Date();
      if (b.action === "start") {
        const d = z
          .object({
            name: z.string().trim().min(1).max(100),
            categoryId: z.string(),
            text: z.string().trim().min(1).max(8000),
            requestId: z.string().uuid(),
          })
          .parse(b.data);
        if (!(await throttle(tx, s, "start:" + getClientIp(req), 120)))
          return { limited: true };
        need(businessOpen(cfg), "Chat is outside opening hours", 409);
        const category = await tx.chatCategory.findFirst({
          where: { workspaceId: s.workspaceId, id: d.categoryId, active: true },
        });
        need(category, "Select a valid category", 400);
        const prior = req.cookies.get("lc_" + link.id)?.value;
        if (prior) {
          const existing = await tx.chatCustomerSession.findFirst({
            where: {
              workspaceId: s.workspaceId,
              tokenHash: hash(link.id + ":" + prior),
              expiresAt: { gt: now },
            },
          });
          if (existing) {
            const current = await tx.chatConversation.findFirst({
              where: {
                workspaceId: s.workspaceId,
                customerSessionId: existing.id,
                status: { in: ["QUEUED", "ASSIGNED", "ACTIVE"] },
              },
            });
            if (current) return { id: current.id };
          }
        }
        await lock(tx, s.workspaceId);
        need(
          process.env.JWT_SECRET,
          "Server session signing is not configured",
          503,
        );
        const value = createHmac("sha256", process.env.JWT_SECRET)
          .update("chat-start:" + link.id + ":" + d.requestId)
          .digest("base64url");
        const existing = await tx.chatCustomerSession.findFirst({
          where: {
            workspaceId: s.workspaceId,
            tokenHash: hash(link.id + ":" + value),
          },
        });
        if (existing) {
          const priorChat = await tx.chatConversation.findFirstOrThrow({
            where: {
              workspaceId: s.workspaceId,
              customerSessionId: existing.id,
            },
            orderBy: { createdAt: "asc" },
          });
          return { id: priorChat.id, cookie: { name: "lc_" + link.id, value } };
        }
        const session = await tx.chatCustomerSession.create({
          data: {
            ...s,
            name: d.name,
            tokenHash: hash(link.id + ":" + value),
            expiresAt: new Date(+now + 86400000),
          },
        });
        const policy = settingsPolicy(training?.policySnapshot, cfg);
        const c = await tx.chatConversation.create({
          data: {
            ...s,
            customerSessionId: session.id,
            customerName: d.name,
            categoryId: d.categoryId,
            sessionId: link.sessionId,
            serviceSeconds: policy.firstReplySeconds,
            policySnapshot: JSON.parse(JSON.stringify(policy)),
            unansweredAt: now,
          },
        });
        await send(
          tx,
          s,
          c,
          { id: session.id, name: d.name, role: "CUSTOMER" },
          { text: d.text, requestId: d.requestId },
        );
        await event(tx, s, session.id, "queued", c.id);
        await dispatch(tx, s, cfg);
        return { id: c.id, cookie: { name: "lc_" + link.id, value } };
      }
      const session = await customer(
        tx,
        s.workspaceId,
        req.cookies.get("lc_" + link.id)?.value || "",
        link.id,
      );
      if (!(await throttle(tx, s, "session:" + session.id, 120)))
        return { limited: true };
      await lock(tx, s.workspaceId);
      const c = await tx.chatConversation.findFirst({
        where: { workspaceId: s.workspaceId, customerSessionId: session.id },
        orderBy: { createdAt: "desc" },
      });
      need(c, "Conversation not found", 404);
      if (
        +now - +session.heartbeatAt > cfg.disconnectSeconds * 1000 &&
        !closed(c.status)
      )
        await event(tx, s, session.id, "reconnected", c.id);
      await tx.chatCustomerSession.update({
        where: {
          workspaceId_id: { workspaceId: s.workspaceId, id: session.id },
        },
        data: { heartbeatAt: now },
      });
      if (b.action === "message")
        return send(
          tx,
          s,
          c,
          { id: session.id, name: session.name, role: "CUSTOMER" },
          {
            ...z
              .object({ text: z.string(), requestId: z.string().uuid() })
              .parse(b.data),
            kind: "MESSAGE",
          },
        );
      if (b.action === "heartbeat") return { ok: true };
      if (b.action === "read" || b.action === "typing") {
        await tx.chatConversation.update({
          where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
          data:
            b.action === "read"
              ? { customerReadAt: now }
              : { customerTypingAt: now },
        });
        await event(tx, s, session.id, b.action, c.id);
        return { ok: true };
      }
      if (b.action === "feedback") {
        need(closed(c.status) && cfg.feedback, "Feedback is unavailable", 409);
        const d = z
          .object({
            rating: z.number().int().min(1).max(5),
            comment: z.string().max(2000).default(""),
          })
          .parse(b.data);
        await tx.chatConversation.update({
          where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
          data: { feedback: d.rating, feedbackComment: d.comment },
        });
        await event(tx, s, session.id, "feedback", c.id, { rating: d.rating });
        return { ok: true };
      }
      if (b.action === "reopen") {
        need(businessOpen(cfg), "Chat is outside opening hours", 409);
        need(
          closed(c.status) &&
            c.closedAt &&
            +now - +c.closedAt <= cfg.reopenSeconds * 1000,
          "Reopening window expired",
          409,
        );
        need(link.active, "This link is paused", 409);
        need(
          !training || training.state === "OPEN",
          "Training session ended",
          409,
        );
        // New lifecycle preserves the original transcript and all original KPI timestamps.
        const policy = settingsPolicy(training?.policySnapshot, cfg);
        const next = await tx.chatConversation.create({
          data: {
            ...s,
            customerSessionId: session.id,
            customerName: c.customerName,
            categoryId: c.categoryId,
            sessionId: c.sessionId,
            customerId: c.customerId,
            complaintId: c.complaintId,
            serviceSeconds: policy.firstReplySeconds,
            policySnapshot: JSON.parse(JSON.stringify(policy)),
            unansweredAt: now,
          },
        });
        await event(tx, s, session.id, "reopened", next.id, {
          previousConversation: c.id,
        });
        await dispatch(tx, s, cfg);
        return { id: next.id };
      }
      need(!closed(c.status), "Already closed", 409);
      await finishAssignments(tx, s, c.id, now);
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
        data: {
          status: c.firstReplyAt ? "CLOSED" : "ABANDONED",
          closedAt: now,
          resolution: "CUSTOMER_ENDED",
          transferTo: null,
          transferAt: null,
        },
      });
      await event(tx, s, session.id, "customer_closed", c.id);
      await dispatch(tx, s, cfg);
      return { ok: true };
    },
    b.action === "start" || b.action === "reopen",
  );
}
