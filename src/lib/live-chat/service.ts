import "server-only";
import { z } from "zod";
import { access, need, hash, secret } from "./access";
import {
  settingsSchema,
  defaults,
  rubric,
  messageInput,
  closed,
  scoreEvaluation,
  metrics,
} from "./domain";
import { bootstrap as crmBootstrap } from "@/lib/customer-service/service";
import type { Identity } from "@/lib/customer-service/access";
import type { Tx } from "@/lib/customer-service/db";
import type { Actor } from "@/lib/customer-service/domain";
import {
  lock,
  event,
  dispatch,
  finishAssignments,
} from "../../../scripts/lib/live-chat-engine.cjs";
import {
  seedPractice,
  advancePractice,
} from "../../../scripts/lib/live-chat-practice.cjs";
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
const scope = (ctx: Identity, workspaceId: string) => ({
  courseId: ctx.courseId,
  workspaceId,
});
export async function config(tx: Tx, workspaceId: string) {
  const row = await tx.chatSettings.findUnique({ where: { workspaceId } });
  return settingsSchema.parse(row?.value || {});
}
export async function bootstrap(ctx: Identity) {
  return crmBootstrap(ctx);
}
export async function conversation(tx: Tx, workspaceId: string, id: string) {
  const c = await tx.chatConversation.findUnique({
    where: { workspaceId_id: { workspaceId, id } },
  });
  need(c, "Conversation not found", 404);
  return c;
}
async function canView(
  tx: Tx,
  ctx: Identity,
  c: Awaited<ReturnType<typeof conversation>>,
) {
  if (
    ctx.staff ||
    c.agentId === ctx.user.id ||
    c.transferTo === ctx.user.id ||
    (c.practiceKey && !c.practiceStartedAt && c.status === "QUEUED")
  )
    return;
  // A prior assignee retains read-only access to their own historical handling.
  const prior = await tx.chatAssignment.findFirst({
    where: {
      workspaceId: c.workspaceId,
      conversationId: c.id,
      agentId: ctx.user.id,
    },
  });
  need(prior, "This conversation is not assigned to you");
}
export async function prepareWorkspace(ctx: Identity, w: string) {
  return access(ctx, w, true, async (tx) => {
    await lock(tx, w);
    const count = await tx.chatConversation.count({
      where: { workspaceId: w, practiceKey: { startsWith: "practice-v1-" } },
    });
    if (count >= 60) return { added: 0, total: 60 };
    const cfg = await config(tx, w);
    return seedPractice(tx, scope(ctx, w), json(cfg), "system");
  });
}
export async function read(ctx: Identity, w: string, q: URLSearchParams) {
  return access(ctx, w, false, async (tx) => {
    const settings = await config(tx, w);
    const kind = q.get("kind") || "state";
    if (kind === "demonstration") {
      const session = await tx.chatTrainingSession.findFirst({
        where: {
          workspaceId: w,
          id: q.get("sessionId") || "",
          mode: "DEMONSTRATION",
          state: "OPEN",
        },
      });
      need(
        session &&
          (!session.endsAt || session.endsAt > new Date()) &&
          (ctx.staff ||
            !session.participants.length ||
            session.participants.includes(ctx.user.id)),
        "Demonstration unavailable",
      );
      const messages = session.demonstrationId
        ? await tx.chatMessage.findMany({
            where: {
              workspaceId: w,
              conversationId: session.demonstrationId,
              kind: "MESSAGE",
            },
            select: { id: true, text: true, sender: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        : [];
      return {
        messages: messages.reverse().map((m) => ({
          ...m,
          senderName:
            m.sender === "CUSTOMER"
              ? "Training customer"
              : m.sender === "SYSTEM"
                ? "System"
                : "Agent",
        })),
      };
    }
    if (kind === "conversation") {
      const c = await conversation(tx, w, q.get("id") || "");
      await canView(tx, ctx, c);
      const before = q.get("before"),
        after = q.get("after");
      const cursor = before || after;
      if (cursor)
        need(
          await tx.chatMessage.findFirst({
            where: { workspaceId: w, id: cursor, conversationId: c.id },
          }),
          "Message cursor not found",
          404,
        );
      const messages = await tx.chatMessage.findMany({
        where: { workspaceId: w, conversationId: c.id },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { sequence: after ? "asc" : "desc" },
        take: 101,
      });
      const evaluations = await tx.chatQaEvaluation.findMany({
        where: {
          workspaceId: w,
          conversationId: c.id,
          ...(!ctx.staff ? { agentId: ctx.user.id, released: true } : {}),
        },
      });
      const events = ctx.staff
        ? await tx.chatEvent.findMany({
            where: { workspaceId: w, conversationId: c.id },
            orderBy: { id: "desc" },
            take: 100,
          })
        : [];
      return {
        conversation: c,
        messages: after
          ? messages.slice(0, 100)
          : messages.slice(0, 100).reverse(),
        hasMore: messages.length > 100,
        evaluations: evaluations.map((e) =>
          ctx.staff ? e : { ...e, privateNote: undefined },
        ),
        events,
      };
    }
    if (kind === "report") return report(tx, ctx, w, q);
    if (kind === "customers")
      return tx.customer.findMany({
        where: {
          workspaceId: w,
          OR: [
            { name: { contains: q.get("search") || "", mode: "insensitive" } },
            { number: { contains: q.get("search") || "" } },
          ],
        },
        take: 30,
      });
    const sessions = await tx.chatTrainingSession.findMany({
      where: {
        workspaceId: w,
        ...(!ctx.staff
          ? {
              OR: [
                { participants: { isEmpty: true } },
                { participants: { has: ctx.user.id } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const references = await tx.chatReference.findMany({
      where: { workspaceId: w, active: true },
      take: 100,
    });
    const historyIds = !ctx.staff
      ? (
          await tx.$queryRaw<
            { conversationId: string }[]
          >`SELECT DISTINCT "conversationId" FROM "ChatAssignment" WHERE "workspaceId"=${w} AND "agentId"=${ctx.user.id}`
        ).map((a) => a.conversationId)
      : [];
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(q.get("page") || 1);
    const query = q.get("search")?.slice(0, 100) || "";
    const listWhere = {
      workspaceId: w,
      ...(!ctx.staff
        ? {
            OR: [
              { agentId: ctx.user.id },
              { transferTo: ctx.user.id },
              { id: { in: historyIds } },
              {
                practiceKey: { not: null },
                practiceStartedAt: null,
                status: "QUEUED",
              },
            ],
          }
        : {}),
      AND: [
        q.get("view") === "history"
          ? { status: { in: ["RESOLVED", "CLOSED", "ABANDONED", "DROPPED"] } }
          : q.get("view") === "queue"
            ? { status: "QUEUED" }
            : { status: { in: ["QUEUED", "ASSIGNED", "ACTIVE"] } },
        ...(query
          ? [
              {
                OR: [
                  {
                    customerName: {
                      contains: query,
                      mode: "insensitive" as const,
                    },
                  },
                  { id: { contains: query } },
                ],
              },
            ]
          : []),
      ],
      ...(q.get("status") ? { status: q.get("status")! } : {}),
    };
    const chats = await tx.chatConversation.findMany({
      where: listWhere,
      orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
      take: 50,
      skip: (page - 1) * 50,
    });
    const total = await tx.chatConversation.count({ where: listWhere });
    const previews = chats.length
      ? await tx.$queryRaw<
          { id: string; preview: string | null; unread: bigint }[]
        >`
      SELECT c.id,
      (SELECT m.text FROM "ChatMessage" m WHERE m."workspaceId"=${w} AND m."conversationId"=c.id AND m.kind='MESSAGE' ORDER BY m.sequence DESC LIMIT 1) AS preview,
      (SELECT count(*) FROM "ChatMessage" m WHERE m."workspaceId"=${w} AND m."conversationId"=c.id AND m.kind='MESSAGE' AND m.sender='CUSTOMER' AND m."createdAt">coalesce(c."agentReadAt",'epoch'::timestamp)) AS unread
      FROM "ChatConversation" c WHERE c."workspaceId"=${w} AND c.id=ANY(${chats.map((c) => c.id)}::text[])`
      : [];
    const counts = await tx.chatConversation.groupBy({
      by: ["status"],
      where: {
        workspaceId: w,
        ...(!ctx.staff ? { agentId: ctx.user.id } : {}),
      },
      _count: true,
    });
    const workloads = await tx.chatConversation.groupBy({
      by: ["agentId"],
      where: { workspaceId: w, status: { in: ["ASSIGNED", "ACTIVE"] } },
      _count: true,
    });
    const agents = await tx.chatAgentState.findMany({
      where: { workspaceId: w },
      orderBy: { name: "asc" },
      take: 500,
    });
    const categories = await tx.chatCategory.findMany({
      where: { workspaceId: w },
      orderBy: { name: "asc" },
    });
    const links = ctx.staff
      ? await tx.chatPublicLink.findMany({
          where: { workspaceId: w },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];
    // Assessment hints are gated on the server, not merely hidden by the UI.
    const restricted = sessions.some(
      (s) =>
        s.mode === "ASSESSMENT" &&
        s.state === "OPEN" &&
        s.startsAt <= new Date() &&
        !s.hints &&
        (!s.endsAt || s.endsAt > new Date()),
    );
    return {
      settings: ctx.staff
        ? settings
        : {
            capacity: settings.capacity,
            firstReplySeconds: settings.firstReplySeconds,
            nextReplySeconds: settings.nextReplySeconds,
            allowTransfer: settings.allowTransfer,
          },
      chats: chats.map((c) => ({
        ...c,
        lastMessagePreview:
          previews.find((p) => p.id === c.id)?.preview?.slice(0, 140) || "",
        unread: Number(previews.find((p) => p.id === c.id)?.unread || 0),
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
      total,
      page,
      agents: agents.map((a) => ({
        ...(ctx.staff
          ? a
          : {
              userId: a.userId,
              name: a.name,
              status: a.status,
              heartbeatAt: a.heartbeatAt,
              lastAssignedAt: a.lastAssignedAt,
              roll: a.userId === ctx.user.id ? a.roll : "",
            }),
        activeChats: workloads.find((v) => v.agentId === a.userId)?._count || 0,
      })),
      categories,
      links,
      sessions: sessions.map((s) =>
        ctx.staff
          ? s
          : { ...s, scenario: s.mode === "ASSESSMENT" ? "" : s.scenario },
      ),
      references: restricted && !ctx.staff ? [] : references,
      identity: {
        id: ctx.user.id,
        name: ctx.user.displayName,
        staff: ctx.staff,
        admin: ctx.admin,
      },
      rubric: settings.qaRubric,
    };
  });
}
export async function send(
  tx: Tx,
  s: { courseId: string; workspaceId: string },
  c: Awaited<ReturnType<typeof conversation>>,
  sender: { id: string; name: string; role: string },
  raw: unknown,
) {
  const input = messageInput.parse(raw);
  const duplicate = await tx.chatMessage.findUnique({
    where: {
      workspaceId_conversationId_senderId_requestId: {
        workspaceId: s.workspaceId,
        conversationId: c.id,
        senderId: sender.id,
        requestId: input.requestId,
      },
    },
  });
  if (duplicate) return duplicate;
  need(!closed(c.status), "Conversation has ended", 409);
  const now = new Date();
  const m = await tx.chatMessage.create({
    data: {
      ...s,
      conversationId: c.id,
      senderId: sender.id,
      senderName: sender.name,
      sender: sender.role,
      kind: input.kind,
      text: input.text,
      requestId: input.requestId,
      createdAt: now,
    },
  });
  if (input.kind === "MESSAGE") {
    const customer = sender.role === "CUSTOMER";
    if (!customer) {
      const assignment = await tx.chatAssignment.findFirst({
        where: {
          workspaceId: s.workspaceId,
          conversationId: c.id,
          agentId: sender.id,
          endedAt: null,
        },
      });
      if (assignment && !assignment.firstReplyAt)
        await tx.chatAssignment.update({
          where: { id: assignment.id },
          data: { firstReplyAt: now },
        });
    }
    await tx.chatConversation.update({
      where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
      data: {
        lastActivityAt: now,
        ...(customer
          ? {
              lastCustomerAt: now,
              unansweredAt: c.unansweredAt || now,
              warned: false,
              customerTypingAt: null,
            }
          : {
              lastAgentAt: now,
              firstReplyAt: c.firstReplyAt || now,
              unansweredAt: null,
              agentTypingAt: null,
            }),
      },
    });
    await event(tx, s, sender.id, "message", c.id, {
      messageId: m.id,
      ...(!customer && c.unansweredAt
        ? {
            responseSeconds: (+now - +c.unansweredAt) / 1000,
            agentId: sender.id,
          }
        : customer && !c.unansweredAt && c.lastAgentAt
          ? { customerResponseSeconds: (+now - +c.lastAgentAt) / 1000 }
          : {}),
    });
  } else
    await event(tx, s, sender.id, input.kind.toLowerCase(), c.id, {
      messageId: m.id,
    });
  if (input.kind === "MESSAGE" && sender.role === "AGENT" && c.practiceKey)
    await advancePractice(tx, s, c);
  return m;
}
const envelope = z.object({
  workspaceId: z.string().min(1),
  action: z.string(),
  id: z.string().optional(),
  data: z.unknown().optional(),
});
export async function mutate(ctx: Identity, raw: unknown) {
  const b = envelope.parse(raw),
    w = b.workspaceId,
    s = scope(ctx, w);
  return access(ctx, w, true, async (tx, a: Actor) => {
    await lock(tx, w);
    const cfg = await config(tx, w),
      now = new Date();
    const staff = () => need(ctx.staff, "Supervisor permission required");
    const admin = () =>
      need(ctx.admin, "CRM administrator permission required");
    if (b.action === "load_practice") {
      staff();
      return seedPractice(tx, s, json(cfg), a.id);
    }
    if (b.action === "initialize") {
      admin();
      await tx.chatSettings.upsert({
        where: { workspaceId: w },
        create: { ...s, value: json(defaults) },
        update: {},
      });
      for (const name of [
        "General enquiry / সাধারণ জিজ্ঞাসা",
        "Order & delivery / অর্ডার ও ডেলিভারি",
        "Payment & refund / পেমেন্ট ও রিফান্ড",
        "Account & service / অ্যাকাউন্ট ও সেবা",
      ])
        await tx.chatCategory.upsert({
          where: { workspaceId_name: { workspaceId: w, name } },
          create: { ...s, name },
          update: {},
        });
      for (const [kind, title, text] of [
        [
          "REPLY",
          "Greeting",
          "Hello! Thank you for contacting us. How may I help you today?",
        ],
        ["REPLY", "স্বাগত", "স্বাগতম! আজ আপনাকে কীভাবে সাহায্য করতে পারি?"],
        [
          "KNOWLEDGE",
          "Training verification",
          "Verify the customer reference before linking a profile. Never request passwords, PINs or OTPs. Follow the scenario policy; do not invent refund promises.",
        ],
      ]) {
        if (
          !(await tx.chatReference.findFirst({
            where: { workspaceId: w, kind, title },
          }))
        )
          await tx.chatReference.create({ data: { ...s, kind, title, text } });
      }
      await event(tx, s, a.id, "initialized");
      return { ok: true };
    }
    if (b.action === "settings") {
      admin();
      const value = settingsSchema.parse(b.data);
      await tx.chatSettings.upsert({
        where: { workspaceId: w },
        create: { ...s, value: json(value) },
        update: { value: json(value), version: { increment: 1 } },
      });
      await event(tx, s, a.id, "settings_changed", null, { settings: value });
      return { ok: true };
    }
    if (b.action === "category") {
      admin();
      const d = z
        .object({
          name: z.string().trim().min(1).max(120),
          active: z.boolean().default(true),
        })
        .parse(b.data);
      const value = b.id
        ? await tx.chatCategory.update({
            where: { workspaceId_id: { workspaceId: w, id: b.id } },
            data: d,
          })
        : await tx.chatCategory.create({ data: { ...s, ...d } });
      await event(tx, s, a.id, "category_changed", null, { id: value.id });
      return value;
    }
    if (b.action === "reference") {
      staff();
      const d = z
        .object({
          kind: z.enum(["REPLY", "KNOWLEDGE"]),
          title: z.string().trim().min(1).max(120),
          text: z.string().trim().min(1).max(20000),
          active: z.boolean().default(true),
        })
        .parse(b.data);
      const value = b.id
        ? await tx.chatReference.update({
            where: { workspaceId_id: { workspaceId: w, id: b.id } },
            data: d,
          })
        : await tx.chatReference.create({ data: { ...s, ...d } });
      await event(tx, s, a.id, "reference_changed", null, { id: value.id });
      return value;
    }
    if (b.action === "session") {
      staff();
      const d = z
        .object({
          name: z.string().trim().min(1).max(120),
          mode: z.enum(["PRACTICE", "DEMONSTRATION", "ASSESSMENT"]),
          scenario: z.string().max(10000).default(""),
          participants: z.array(z.string()).max(500).default([]),
          hints: z.boolean().default(true),
          startsAt: z.coerce.date(),
          endsAt: z.coerce.date().nullable(),
          passMark: z.number().int().min(0).max(100).default(cfg.passMark),
        })
        .parse(b.data);
      need(!d.endsAt || d.endsAt > d.startsAt, "End must follow start", 400);
      const members = await tx.member.findMany({
        where: { workspaceId: w, userId: { in: d.participants }, active: true },
      });
      need(
        members.length === d.participants.length,
        "Select current workspace members",
        400,
      );
      const value = await tx.chatTrainingSession.create({
        data: {
          ...s,
          ...d,
          rubric: json(cfg.qaRubric),
          policySnapshot: json(cfg),
        },
      });
      await event(tx, s, a.id, "session_created", null, { id: value.id });
      return value;
    }
    if (b.action === "session_state") {
      staff();
      const d = z
        .object({
          state: z.enum(["OPEN", "CLOSED"]),
          released: z.boolean().default(false),
        })
        .parse(b.data);
      const value = await tx.chatTrainingSession.update({
        where: { workspaceId_id: { workspaceId: w, id: b.id || "" } },
        data: d,
      });
      if (d.released)
        await tx.chatQaEvaluation.updateMany({
          where: {
            workspaceId: w,
            conversationId: {
              in: (
                await tx.chatConversation.findMany({
                  where: { workspaceId: w, sessionId: value.id },
                  select: { id: true },
                })
              ).map((c) => c.id),
            },
          },
          data: { released: true },
        });
      await event(tx, s, a.id, "session_changed", null, { id: value.id, ...d });
      return value;
    }
    if (b.action === "link") {
      staff();
      const d = z
        .object({
          sessionId: z.string().nullable().default(null),
          hours: z.number().int().min(1).max(720).default(24),
        })
        .parse(b.data);
      if (d.sessionId)
        need(
          await tx.chatTrainingSession.findFirst({
            where: { workspaceId: w, id: d.sessionId },
          }),
          "Session not found",
          404,
        );
      const token = w + "." + secret();
      const value = await tx.chatPublicLink.create({
        data: {
          ...s,
          sessionId: d.sessionId,
          tokenHash: hash(token),
          expiresAt: new Date(+now + d.hours * 3600000),
        },
      });
      await event(tx, s, a.id, "link_created", null, { id: value.id });
      return { id: value.id, path: "/live-chat/" + token };
    }
    if (b.action === "link_state") {
      staff();
      const d = z.object({ active: z.boolean() }).parse(b.data);
      const value = await tx.chatPublicLink.update({
        where: { workspaceId_id: { workspaceId: w, id: b.id || "" } },
        data: d,
      });
      await event(tx, s, a.id, "link_changed", null, { id: value.id, ...d });
      return { ok: true };
    }
    if (b.action === "presence") {
      const d = z
        .object({
          status: z.enum(["AVAILABLE", "BUSY", "AWAY", "OFFLINE"]).optional(),
        })
        .parse(b.data || {});
      const prior = await tx.chatAgentState.findUnique({
        where: { workspaceId_userId: { workspaceId: w, userId: a.id } },
      });
      const status = d.status || prior?.status || "OFFLINE";
      // Staff must explicitly opt into handling; they already passed CRM permissions.
      if (ctx.staff && status !== "OFFLINE")
        await tx.member.upsert({
          where: { workspaceId_userId: { workspaceId: w, userId: a.id } },
          create: { ...s, userId: a.id, role: "AGENT" },
          update: {},
        });
      const value = await tx.chatAgentState.upsert({
        where: { workspaceId_userId: { workspaceId: w, userId: a.id } },
        create: {
          ...s,
          userId: a.id,
          name: a.name,
          roll: ctx.user.studentRoll || "",
          status,
        },
        update: {
          heartbeatAt: now,
          name: a.name,
          ...(d.status ? { status, statusAt: now } : {}),
        },
      });
      if (prior?.status !== status)
        await event(tx, s, a.id, "availability", null, {
          previous: prior?.status || "OFFLINE",
          status,
        });
      if (status === "OFFLINE" && d.status) {
        const owned = await tx.chatConversation.findMany({
          where: {
            workspaceId: w,
            agentId: a.id,
            status: { in: ["ASSIGNED", "ACTIVE"] },
          },
        });
        for (const chat of owned) {
          await finishAssignments(tx, s, chat.id, now);
          await tx.chatConversation.update({
            where: { id: chat.id },
            data: {
              status: "QUEUED",
              agentId: null,
              assignedAt: null,
              acceptedAt: null,
              transferTo: null,
              transferAt: null,
            },
          });
          await event(tx, s, a.id, "requeued", chat.id, {
            previousAgent: a.id,
            reason: "manual_offline",
          });
        }
      }
      await dispatch(tx, s, cfg);
      return value;
    }
    const c = await conversation(tx, w, b.id || "");
    await canView(tx, ctx, c);
    const owner = () =>
      need(
        c.agentId === a.id,
        "Only the current agent can perform this action",
      );
    if (b.action === "claim_practice") {
      need(
        c.practiceKey && c.status === "QUEUED",
        "This practice chat has already been started",
        409,
      );
      const count = await tx.chatConversation.count({
        where: {
          workspaceId: w,
          agentId: a.id,
          status: { in: ["ASSIGNED", "ACTIVE"] },
        },
      });
      need(
        count < cfg.capacity,
        "Close an active conversation before starting another practice chat",
        409,
      );
      if (ctx.staff)
        await tx.member.upsert({
          where: { workspaceId_userId: { workspaceId: w, userId: a.id } },
          create: { ...s, userId: a.id, role: "AGENT" },
          update: {},
        });
      need(
        await tx.member.findFirst({
          where: { workspaceId: w, userId: a.id, active: true },
        }),
        "Active membership required",
      );
      const prior = await tx.chatAgentState.findUnique({
        where: { workspaceId_userId: { workspaceId: w, userId: a.id } },
      });
      await tx.chatAgentState.upsert({
        where: { workspaceId_userId: { workspaceId: w, userId: a.id } },
        create: {
          ...s,
          userId: a.id,
          name: a.name,
          roll: ctx.user.studentRoll || "",
          status: "BUSY",
        },
        update: {
          status: "BUSY",
          statusAt: now,
          heartbeatAt: now,
          lastAssignedAt: now,
        },
      });
      if (prior?.status !== "BUSY")
        await event(tx, s, a.id, "availability", null, {
          status: "BUSY",
          reason: "selected_practice",
        });
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: w, id: c.id } },
        data: {
          agentId: a.id,
          status: "ACTIVE",
          practiceStartedAt: c.practiceStartedAt || now,
          queueAt: c.practiceStartedAt ? c.queueAt : now,
          unansweredAt: c.unansweredAt || now,
          assignedAt: now,
          acceptedAt: now,
        },
      });
      await tx.chatAssignment.create({
        data: {
          ...s,
          conversationId: c.id,
          agentId: a.id,
          startedAt: now,
          acceptedAt: now,
        },
      });
      await event(tx, s, a.id, "accepted", c.id, { practice: true });
      return { ok: true };
    }
    if (b.action === "accept") {
      owner();
      need(c.status === "ASSIGNED", "Chat is not awaiting acceptance", 409);
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: w, id: c.id } },
        data: { status: "ACTIVE", acceptedAt: now },
      });
      await tx.chatAssignment.updateMany({
        where: {
          workspaceId: w,
          conversationId: c.id,
          agentId: a.id,
          endedAt: null,
        },
        data: { acceptedAt: now },
      });
      await event(tx, s, a.id, "accepted", c.id);
      return { ok: true };
    }
    if (b.action === "message") {
      const d = messageInput.parse(b.data);
      if (d.kind === "COACH") staff();
      else {
        owner();
        need(c.status === "ACTIVE", "Accept the chat before replying", 409);
      }
      return send(
        tx,
        s,
        c,
        {
          id: a.id,
          name: a.name,
          role: d.kind === "COACH" ? "SUPERVISOR" : "AGENT",
        },
        d,
      );
    }
    if (b.action === "read" || b.action === "typing") {
      owner();
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: w, id: c.id } },
        data:
          b.action === "read" ? { agentReadAt: now } : { agentTypingAt: now },
      });
      await event(tx, s, a.id, b.action, c.id);
      return { ok: true };
    }
    if (
      b.action === "assign" ||
      b.action === "transfer" ||
      b.action === "takeover" ||
      b.action === "accept_transfer"
    ) {
      need(!closed(c.status), "Conversation has ended", 409);
      if (b.action === "transfer") {
        owner();
        need(cfg.allowTransfer, "Agent transfer is disabled");
      } else if (b.action !== "accept_transfer") staff();
      let target =
        b.action === "takeover"
          ? a.id
          : b.action === "accept_transfer"
            ? a.id
            : z.object({ agentId: z.string() }).parse(b.data).agentId;
      if (b.action === "accept_transfer")
        need(c.transferTo === a.id, "No transfer invitation");
      const state = await tx.chatAgentState.findFirst({
        where: {
          workspaceId: w,
          userId: target,
          status: "AVAILABLE",
          heartbeatAt: { gte: new Date(+now - cfg.disconnectSeconds * 1000) },
        },
      });
      need(state, "Target agent must be online and Available", 409);
      need(
        await tx.member.findFirst({
          where: { workspaceId: w, userId: target, active: true },
        }),
        "Agent is inactive",
        409,
      );
      const count = await tx.chatConversation.count({
        where: {
          workspaceId: w,
          agentId: target,
          status: { in: ["ASSIGNED", "ACTIVE"] },
          id: { not: c.id },
        },
      });
      need(count < cfg.capacity, "Target agent is at capacity", 409);
      if (c.sessionId) {
        const session = await tx.chatTrainingSession.findFirst({
          where: { workspaceId: w, id: c.sessionId },
        });
        need(
          (ctx.staff && b.action === "takeover") ||
            !session?.participants.length ||
            session.participants.includes(target),
          "Target is not a session participant",
        );
      }
      if (b.action === "transfer") {
        need(target !== c.agentId, "Choose another agent", 400);
        await tx.chatConversation.update({
          where: { workspaceId_id: { workspaceId: w, id: c.id } },
          data: { transferTo: target, transferAt: now },
        });
        await event(tx, s, a.id, "transfer_requested", c.id, {
          from: c.agentId,
          to: target,
        });
      } else {
        await finishAssignments(tx, s, c.id, now);
        await tx.chatConversation.update({
          where: { workspaceId_id: { workspaceId: w, id: c.id } },
          data: {
            agentId: target,
            status: b.action === "assign" ? "ASSIGNED" : "ACTIVE",
            assignedAt: now,
            acceptedAt: b.action === "assign" ? null : now,
            transferTo: null,
            transferAt: null,
          },
        });
        await tx.chatAssignment.create({
          data: {
            ...s,
            conversationId: c.id,
            agentId: target,
            startedAt: now,
            acceptedAt: b.action === "assign" ? null : now,
          },
        });
        await tx.chatAgentState.update({
          where: { workspaceId_userId: { workspaceId: w, userId: target } },
          data: { lastAssignedAt: now },
        });
        await event(tx, s, a.id, b.action, c.id, {
          from: c.agentId,
          to: target,
        });
      }
      return { ok: true };
    }
    if (b.action === "close") {
      if (!ctx.staff) owner();
      need(!closed(c.status), "Already closed", 409);
      const d = z
        .object({
          resolved: z.boolean(),
          resolution: z.string().trim().min(1).max(120),
          note: z.string().trim().min(1).max(4000),
          wrapSeconds: z.number().int().min(0).max(600).default(0),
        })
        .parse(b.data);
      need(
        !d.resolved || c.firstReplyAt,
        "Unanswered chats cannot be resolved",
        409,
      );
      await finishAssignments(tx, s, c.id, now);
      const segment = await tx.chatAssignment.findFirst({
        where: {
          workspaceId: w,
          conversationId: c.id,
          agentId: c.agentId || "",
        },
        orderBy: { startedAt: "desc" },
      });
      if (segment)
        await tx.chatAssignment.update({
          where: { id: segment.id },
          data: { wrapSeconds: d.wrapSeconds },
        });
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: w, id: c.id } },
        data: {
          status: d.resolved ? "RESOLVED" : "CLOSED",
          resolvedAt: d.resolved ? now : null,
          closedAt: now,
          resolution: d.resolution,
          closingNote: d.note,
          transferTo: null,
          transferAt: null,
          lastActivityAt: now,
        },
      });
      await event(tx, s, a.id, "closed", c.id, d);
      await dispatch(tx, s, cfg);
      return { ok: true };
    }
    if (b.action === "crm_link") {
      if (!ctx.staff) owner();
      const d = z
        .object({
          customerId: z.string().nullable(),
          complaintId: z.string().nullable(),
        })
        .parse(b.data);
      if (d.customerId)
        need(
          await tx.customer.findFirst({
            where: { workspaceId: w, id: d.customerId },
          }),
          "Customer not found",
          404,
        );
      if (d.complaintId) {
        const complaint = await tx.complaint.findFirst({
          where: { workspaceId: w, id: d.complaintId },
        });
        need(
          complaint &&
            (ctx.staff || a.role === "AGENT" || complaint.teamId === a.teamId),
          "Complaint is not accessible",
        );
      }
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: w, id: c.id } },
        data: d,
      });
      await event(tx, s, a.id, "crm_linked", c.id, d);
      return { ok: true };
    }
    if (b.action === "evaluate") {
      staff();
      const d = z
        .object({
          agentId: z.string(),
          scores: z.record(z.string(), z.number()),
          feedback: z.string().max(8000),
          privateNote: z.string().max(8000).default(""),
          released: z.boolean().default(false),
        })
        .parse(b.data);
      need(
        await tx.chatAssignment.findFirst({
          where: { workspaceId: w, conversationId: c.id, agentId: d.agentId },
        }),
        "Agent did not handle this conversation",
        400,
      );
      const session = c.sessionId
        ? await tx.chatTrainingSession.findFirst({
            where: { workspaceId: w, id: c.sessionId },
          })
        : null;
      const criteria = (session?.rubric || cfg.qaRubric) as typeof rubric;
      let total: number;
      try {
        total = scoreEvaluation(d.scores, criteria);
      } catch {
        need(
          false,
          "Scores must match every rubric criterion and its maximum",
          400,
        );
      }
      const evaluation = {
        ...d,
        evaluatorId: a.id,
        rubric: json(criteria),
        scores: json(d.scores),
        total,
        passMark: session?.passMark ?? cfg.passMark,
      };
      const value = await tx.chatQaEvaluation.upsert({
        where: {
          workspaceId_conversationId_agentId: {
            workspaceId: w,
            conversationId: c.id,
            agentId: d.agentId,
          },
        },
        create: { ...s, conversationId: c.id, ...evaluation },
        update: evaluation,
      });
      await event(tx, s, a.id, "evaluated", c.id, {
        agentId: d.agentId,
        total,
        released: d.released,
      });
      return value;
    }
    if (b.action === "demonstrate") {
      staff();
      const d = z.object({ sessionId: z.string() }).parse(b.data);
      const session = await tx.chatTrainingSession.findFirst({
        where: {
          workspaceId: w,
          id: d.sessionId,
          mode: "DEMONSTRATION",
          state: "OPEN",
        },
      });
      need(session, "Open demonstration session required", 400);
      await tx.chatTrainingSession.update({
        where: { workspaceId_id: { workspaceId: w, id: session.id } },
        data: { demonstrationId: c.id },
      });
      await event(tx, s, a.id, "demonstration_changed", null, {
        sessionId: session.id,
      });
      return { ok: true };
    }
    need(false, "Unknown chat action", 400);
  });
}
export async function report(
  tx: Tx,
  ctx: Identity,
  w: string,
  q: URLSearchParams,
) {
  const dates = z.object({ from: z.coerce.date(), to: z.coerce.date() }).parse({
    from: q.get("from") || new Date(new Date().setUTCHours(0, 0, 0, 0)),
    to: q.get("to") || new Date(),
  });
  need(dates.to >= dates.from, "Invalid date range", 400);
  const where = {
    workspaceId: w,
    createdAt: { gte: dates.from, lte: dates.to },
    ...(q.get("sessionId") ? { sessionId: q.get("sessionId")! } : {}),
    ...(q.get("status") ? { status: q.get("status")! } : {}),
  };
  const assignments = await tx.chatAssignment.findMany({
    where: {
      workspaceId: w,
      startedAt: { lte: new Date(Math.min(+dates.to, Date.now())) },
      OR: [{ endedAt: null }, { endedAt: { gte: dates.from } }],
      ...(!ctx.staff
        ? { agentId: ctx.user.id }
        : q.get("agentId")
          ? { agentId: q.get("agentId")! }
          : {}),
    },
    take: 50001,
  });
  need(assignments.length <= 50000, "Narrow the reporting period", 413);
  const agentFiltered = !ctx.staff || !!q.get("agentId");
  const rows = await tx.chatConversation.findMany({
    where: {
      ...where,
      ...(agentFiltered
        ? { id: { in: assignments.map((a) => a.conversationId) } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 20001,
  });
  need(rows.length <= 20000, "Narrow the reporting period", 413);
  const ids = new Set(rows.map((c) => c.id)),
    segments = assignments.filter((a) => ids.has(a.conversationId));
  const evaluations = await tx.chatQaEvaluation.findMany({
    where: {
      workspaceId: w,
      conversationId: { in: [...ids] },
      ...(!ctx.staff
        ? { agentId: ctx.user.id, released: true }
        : q.get("agentId")
          ? { agentId: q.get("agentId")! }
          : {}),
    },
  });
  const events = await tx.chatEvent.findMany({
    where: {
      workspaceId: w,
      createdAt: { gte: dates.from, lte: dates.to },
      type: {
        in: [
          "message",
          "transfer_requested",
          "accept_transfer",
          "takeover",
          "availability",
        ],
      },
    },
    orderBy: { id: "asc" },
    take: 100001,
  });
  need(events.length <= 100000, "Narrow the reporting period", 413);
  const responses = events
    .filter((e) => ids.has(e.conversationId || "") && e.type === "message")
    .map((e) => e.data as { responseSeconds?: number; agentId?: string })
    .filter(
      (e) =>
        e.responseSeconds !== undefined &&
        (!agentFiltered ||
          e.agentId === (ctx.staff ? q.get("agentId") : ctx.user.id)),
    );
  const mean = (ns: number[]) =>
    ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
  const cutoffTime = Math.min(+dates.to, Date.now());
  // Active handling integrates overlapping accepted assignment intervals, splitting
  // each interval equally among that agent's concurrent conversations.
  const handling = new Map<string, number>();
  const byAgent = new Map<string, typeof segments>();
  for (const a of assignments)
    if (a.acceptedAt && +a.acceptedAt <= cutoffTime)
      byAgent.set(a.agentId, [...(byAgent.get(a.agentId) || []), a]);
  for (const list of byAgent.values()) {
    const points = [
      ...new Set(
        list.flatMap((a) => [
          +a.acceptedAt!,
          Math.min(+(a.endedAt || new Date(cutoffTime)), cutoffTime),
        ]),
      ),
    ].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const open = list.filter(
        (a) =>
          +a.acceptedAt! <= points[i] &&
          Math.min(+(a.endedAt || new Date(cutoffTime)), cutoffTime) >=
            points[i + 1],
      );
      for (const a of open)
        handling.set(
          a.id,
          (handling.get(a.id) || 0) +
            (points[i + 1] - points[i]) / 1000 / open.length,
        );
    }
  }
  const states = await tx.chatAgentState.findMany({
    where: {
      workspaceId: w,
      ...(agentFiltered
        ? { userId: ctx.staff ? q.get("agentId")! : ctx.user.id }
        : {}),
    },
  });
  const agentRows = await Promise.all(
    [
      ...new Set([
        ...segments.map((a) => a.agentId),
        ...states.map((a) => a.userId),
      ]),
    ].map(async (agentId) => {
      const own = segments.filter((a) => a.agentId === agentId),
        answered = own.filter((a) => a.firstReplyAt),
        qa = evaluations.filter((e) => e.agentId === agentId);
      const prior = await tx.chatEvent.findFirst({
        where: {
          workspaceId: w,
          actorId: agentId,
          type: "availability",
          createdAt: { lt: dates.from },
        },
        orderBy: { id: "desc" },
      });
      const changes = events.filter(
        (e) => e.actorId === agentId && e.type === "availability",
      );
      const durations: Record<string, number> = {
        AVAILABLE: 0,
        BUSY: 0,
        AWAY: 0,
        OFFLINE: 0,
      };
      let status = (prior?.data as { status?: string })?.status || "OFFLINE",
        start = +dates.from;
      const cutoff = Math.min(+dates.to, Date.now());
      for (const change of [
        ...changes,
        { createdAt: new Date(cutoff), data: { status: "OFFLINE" } },
      ]) {
        const at = Math.min(+change.createdAt, cutoff);
        durations[status] =
          (durations[status] || 0) + Math.max(0, at - start) / 1000;
        start = at;
        status = (change.data as { status: string }).status;
      }
      const agent = states.find((s) => s.userId === agentId);
      return {
        agentId,
        name: agent?.name || agentId,
        roll: agent?.roll || "",
        assigned: own.length,
        answered: answered.length,
        resolved: rows.filter(
          (c) => c.status === "RESOLVED" && c.agentId === agentId,
        ).length,
        active: rows.filter((c) => !closed(c.status) && c.agentId === agentId)
          .length,
        handleSeconds: own.reduce(
          (n, a) => n + (handling.get(a.id) || 0) + a.wrapSeconds,
          0,
        ),
        aht: mean(
          answered
            .filter((a) => a.endedAt)
            .map((a) => (handling.get(a.id) || 0) + a.wrapSeconds),
        ),
        qa: mean(qa.map((e) => e.total)),
        availableSeconds: durations.AVAILABLE,
        busySeconds: durations.BUSY,
        awaySeconds: durations.AWAY,
        onlineSeconds: durations.AVAILABLE + durations.BUSY + durations.AWAY,
      };
    }),
  );
  const answeredSegments = segments.filter((s) => s.firstReplyAt && s.endedAt);
  const firstAcceptances = await tx.chatAssignment.groupBy({
    by: ["conversationId"],
    where: {
      workspaceId: w,
      conversationId: { in: [...ids] },
      acceptedAt: { not: null },
    },
    _min: { acceptedAt: true },
  });
  const metricRows = rows.map((r) => ({
    ...r,
    acceptedAt:
      firstAcceptances.find((a) => a.conversationId === r.id)?._min
        .acceptedAt || null,
  }));
  const timezone = (await config(tx, w)).timezone;
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(r.createdAt);
    byDay.set(day, [...(byDay.get(day) || []), r]);
  }
  const daily = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, rs]) => ({ day, ...metrics(rs) }));
  return {
    basis:
      "Conversation creation cohort; current status. FRT from first queue entry. Timing in seconds. AHT is accepted elapsed handling split across concurrent assignments, plus declared wrap-up; it is not keyboard-active time. Availability uses the reporting period. Original first reply belongs to the conversation; transferred agents have separate handling segments.",
    generatedAt: new Date(),
    period: dates,
    filters: {
      workspaceId: w,
      agentId: agentFiltered
        ? ctx.staff
          ? q.get("agentId")
          : ctx.user.id
        : null,
      sessionId: q.get("sessionId"),
      status: q.get("status"),
    },
    metrics: {
      ...metrics(metricRows),
      responseTime: mean(responses.map((e) => e.responseSeconds!)),
      customerResponseTime: mean(
        events
          .filter(
            (e) => ids.has(e.conversationId || "") && e.type === "message",
          )
          .map(
            (e) =>
              (e.data as { customerResponseSeconds?: number })
                .customerResponseSeconds,
          )
          .filter((v): v is number => v !== undefined),
      ),
      unansweredRate: rows.length
        ? (rows.filter((r) => !r.firstReplyAt).length / rows.length) * 100
        : null,
      maximumQueueWait: metricRows.some((r) => r.acceptedAt)
        ? Math.max(
            ...metricRows
              .filter((r) => r.acceptedAt)
              .map((r) => (+r.acceptedAt! - +r.queueAt) / 1000),
          )
        : null,
      aht: mean(
        answeredSegments.map((a) => (handling.get(a.id) || 0) + a.wrapSeconds),
      ),
      customerSatisfaction: mean(
        rows.filter((r) => r.feedback !== null).map((r) => r.feedback!),
      ),
      transferCount: events.filter(
        (e) => e.type === "accept_transfer" && ids.has(e.conversationId || ""),
      ).length,
    },
    rows,
    agents: agentRows,
    daily,
    evaluations: evaluations.map((e) => ({
      ...e,
      privateNote: ctx.staff ? e.privateNote : undefined,
    })),
    timezone,
  };
}
