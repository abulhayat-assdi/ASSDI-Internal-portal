import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { scoped, crmClient } from "@/lib/customer-service/db";
import type { Identity } from "@/lib/customer-service/access";
import { mutate, read, conversation, prepareWorkspace } from "./service";
import { chatIdentity } from "./access";
import { publicMutate, publicRead } from "./public";
import { signJWT } from "@/lib/auth";
import { tick, dispatch } from "../../../scripts/lib/live-chat-engine.cjs";
import { writeFileSync } from "node:fs";
const enabled = process.env.CRM_INTEGRATION === "1";
describe.skipIf(!enabled)("Live Chat isolated PostgreSQL", () => {
  const suffix = randomUUID().slice(0, 8),
    courseId = "lc-" + suffix,
    slug = "lc-" + suffix,
    batchId = "batch-" + suffix;
  let w: string,
    admin: Identity,
    agent: Identity,
    second: Identity,
    third: Identity,
    token: string,
    categoryId: string;
  const customers = new Map<
    string,
    { cookie: string; conversationId: string }
  >();
  const req = (cookie = "") =>
    new NextRequest(
      "http://" + slug + ".localhost/api/live-chat/public/" + token,
      {
        headers: {
          host: slug + ".localhost",
          cookie,
          "x-forwarded-for": "127.0.0.1",
        },
      },
    );
  const act = (ctx: Identity, action: string, data?: unknown, id?: string) =>
    mutate(ctx, { workspaceId: w, action, data, id });
  async function start(name: string) {
    const v = (await publicMutate(req(), token, {
      action: "start",
      data: {
        name,
        categoryId,
        text: "I need a payment refund. / টাকা ফেরত চাই।",
        requestId: randomUUID(),
      },
    })) as { id: string; cookie: { name: string; value: string } };
    const result = {
      cookie: v.cookie.name + "=" + v.cookie.value,
      conversationId: v.id,
    };
    customers.set(name, result);
    return result;
  }
  beforeAll(async () => {
    for (const key of ["DATABASE_URL", "CUSTOMER_SERVICE_DATABASE_URL"]) {
      const u = new URL(process.env[key]!);
      if (
        u.hostname !== "127.0.0.1" ||
        u.port !== "55439" ||
        !u.pathname.endsWith("_test")
      )
        throw Error("Disposable local databases required");
    }
    await prisma.course.create({
      data: {
        id: courseId,
        slug,
        name: "Chat Training",
        settings: { features: { crm: true, live_chat: true } },
      },
    });
    await prisma.batch.create({
      data: { id: batchId, courseId, name: "Training" },
    });
    const context = (id: string, staff = false): Identity => ({
      courseId,
      batchId: staff ? undefined : batchId,
      admin: staff,
      staff,
      user: {
        id: id + "-" + suffix,
        email: id + "@example.test",
        displayName: id,
        role: staff ? "admin" : "student",
        courseId,
        studentBatchName: "Training",
        studentRoll: id,
        permissions: staff ? ["crm_admin", "crm_supervisor"] : [],
      },
    });
    admin = context("admin", true);
    agent = context("agent");
    second = context("second");
    third = context("third");
    for (const ctx of [admin, agent, second, third]) {
      await prisma.user.create({
        data: {
          id: ctx.user.id,
          courseId,
          email: ctx.user.email,
          displayName: ctx.user.displayName,
          role: ctx.user.role as "student" | "admin",
          passwordHash: "test-only",
          studentBatchName: "Training",
          studentRoll: ctx.user.studentRoll,
          permissions: ctx.user.permissions,
          activeSession: {
            create: { expiresAt: new Date(Date.now() + 3600000) },
          },
        },
      });
      if (!ctx.staff)
        await prisma.batchStudent.create({
          data: {
            courseId,
            batchId,
            batchName: "Training",
            roll: ctx.user.studentRoll!,
            name: ctx.user.displayName,
          },
        });
    }
    w = (
      await scoped(courseId, "", (tx) =>
        tx.workspace.create({ data: { courseId, batchId, name: "Training" } }),
      )
    ).id;
    await act(admin, "initialize");
    categoryId = (
      await scoped(courseId, w, (tx) =>
        tx.chatCategory.findFirstOrThrow({ where: { workspaceId: w } }),
      )
    ).id;
    token = ((await act(admin, "link", { hours: 24 })) as { path: string }).path
      .split("/")
      .pop()!;
  }, 30000);
  afterAll(async () => {
    if (process.env.LIVE_CHAT_BROWSER_FIXTURE === "1") {
      await prisma.batchStudent.updateMany({
        where: { courseId },
        data: { courseStatus: "Running" },
      });
      await scoped(courseId, w, async (tx) => {
        await tx.chatConversation.updateMany({
          where: {
            workspaceId: w,
            status: { in: ["QUEUED", "ACTIVE", "ASSIGNED"] },
            OR: [{ practiceKey: null }, { practiceStartedAt: { not: null } }],
          },
          data: { status: "CLOSED", closedAt: new Date() },
        });
        await tx.chatAssignment.updateMany({
          where: { workspaceId: w, endedAt: null },
          data: { endedAt: new Date() },
        });
        await tx.chatAgentState.updateMany({
          where: { workspaceId: w },
          data: { status: "OFFLINE" },
        });
      });
      const sessions = {
        admin: await signJWT(admin.user),
        agent: await signJWT(agent.user),
        second: await signJWT(second.user),
      };
      writeFileSync(
        ".crm-test/live-chat-browser.json",
        JSON.stringify({
          host: slug + ".localhost",
          workspaceId: w,
          token,
          sessions,
          categoryId,
        }),
      );
    }
    await Promise.all([prisma.$disconnect(), crmClient().$disconnect()]);
  });
  it("requires a name and valid category before entry", async () => {
    await expect(
      publicMutate(req(), token, {
        action: "start",
        data: { name: "", categoryId, text: "hi", requestId: randomUUID() },
      }),
    ).rejects.toThrow();
    await expect(
      publicMutate(req(), token, {
        action: "start",
        data: {
          name: "Customer",
          categoryId: "other-workspace",
          text: "hi",
          requestId: randomUUID(),
        },
      }),
    ).rejects.toThrow("category");
  });
  it("queues when no agent is available, then assigns on availability", async () => {
    const first = await start("first");
    expect(
      (
        await scoped(courseId, w, (tx) =>
          conversation(tx, w, first.conversationId),
        )
      ).status,
    ).toBe("QUEUED");
    await act(agent, "presence", { status: "AVAILABLE" });
    const c = await scoped(courseId, w, (tx) =>
      conversation(tx, w, first.conversationId),
    );
    expect(c.agentId).toBe(agent.user.id);
    expect(c.status).toBe("ASSIGNED");
  });
  it("prevents duplicate concurrent assignments and honors capacity", async () => {
    await act(second, "presence", { status: "AVAILABLE" });
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => start("parallel-" + i)),
    );
    const rows = await scoped(courseId, w, (tx) =>
      tx.chatConversation.findMany({ where: { workspaceId: w } }),
    );
    for (const id of [agent.user.id, second.user.id])
      expect(
        rows.filter(
          (r) => r.agentId === id && !["CLOSED", "RESOLVED"].includes(r.status),
        ).length,
      ).toBeLessThanOrEqual(3);
    expect(rows.filter((r) => r.status === "QUEUED").length).toBe(3);
    const duplicate = await scoped(
      courseId,
      w,
      (tx) =>
        tx.$queryRaw<
          { count: bigint }[]
        >`SELECT count(*) FROM (SELECT "conversationId" FROM "ChatAssignment" WHERE "workspaceId"=${w} AND "endedAt" IS NULL GROUP BY "conversationId" HAVING count(*)>1) x`,
    );
    expect(Number(duplicate[0].count)).toBe(0);
  });
  it("persists messages, deduplicates retry, and hides private notes from customer", async () => {
    const first = customers.get("first")!;
    await act(agent, "accept", {}, first.conversationId);
    const message = {
      text: "Hello, I will verify your reference.",
      requestId: randomUUID(),
    };
    await act(agent, "message", message, first.conversationId);
    await act(agent, "message", message, first.conversationId);
    await act(
      agent,
      "message",
      {
        text: "Private verification note",
        kind: "NOTE",
        requestId: randomUUID(),
      },
      first.conversationId,
    );
    await act(
      admin,
      "message",
      {
        text: "Coaching: show empathy.",
        kind: "COACH",
        requestId: randomUUID(),
      },
      first.conversationId,
    );
    const v = (await publicRead(
      new NextRequest(req(first.cookie).url + "?kind=conversation", {
        headers: req(first.cookie).headers,
      }),
      token,
    )) as { messages: { text: string }[] };
    expect(v.messages.filter((m) => m.text === message.text)).toHaveLength(1);
    expect(
      v.messages.some(
        (m) => m.text.includes("Private") || m.text.includes("Coaching"),
      ),
    ).toBe(false);
    await expect(
      read(
        third,
        w,
        new URLSearchParams({ kind: "conversation", id: first.conversationId }),
      ),
    ).rejects.toThrow("not assigned");
  });
  it("blocks customer session theft across customers", async () => {
    const a = customers.get("first")!,
      b = customers.get("parallel-0")!;
    const v = (await publicRead(
      new NextRequest(req(b.cookie).url + "?kind=conversation", {
        headers: req(b.cookie).headers,
      }),
      token,
    )) as { conversation: { id: string } };
    expect(v.conversation.id).toBe(b.conversationId);
    expect(v.conversation.id).not.toBe(a.conversationId);
    await expect(
      publicRead(
        new NextRequest(req().url + "?kind=conversation", {
          headers: req().headers,
        }),
        token,
      ),
    ).rejects.toThrow("session");
  });
  it("enforces database course scope and append-only history", async () => {
    expect(
      await scoped("other-course", w, (tx) => tx.chatMessage.count()),
    ).toBe(0);
    await expect(
      scoped(courseId, w, (tx) =>
        tx.chatEvent.deleteMany({ where: { workspaceId: w } }),
      ),
    ).rejects.toThrow();
    await expect(
      scoped(courseId, w, (tx) =>
        tx.chatMessage.deleteMany({ where: { workspaceId: w } }),
      ),
    ).rejects.toThrow();
  });
  it("returns unanswered assignments to the queue without resetting queue time", async () => {
    const pending = customers.get("parallel-0")!;
    const before = await scoped(courseId, w, (tx) =>
      conversation(tx, w, pending.conversationId),
    );
    await scoped(courseId, w, async (tx) => {
      await tx.chatConversation.update({
        where: { id: before.id },
        data: { assignedAt: new Date(Date.now() - 120000) },
      });
      await tick(tx, { courseId, workspaceId: w });
    });
    const after = await scoped(courseId, w, (tx) =>
      conversation(tx, w, before.id),
    );
    expect(after.queueAt).toEqual(before.queueAt);
    expect(after.status).toBe("QUEUED");
  });
  it("keeps ownership until a transfer is accepted and permits supervisor takeover", async () => {
    const first = customers.get("first")!;
    // Remove queued competition and make the recipient available with spare capacity.
    await scoped(courseId, w, (tx) =>
      tx.chatConversation.updateMany({
        where: { workspaceId: w, status: "QUEUED" },
        data: { status: "CLOSED", closedAt: new Date() },
      }),
    );
    await act(third, "presence", { status: "AVAILABLE" });
    await act(
      agent,
      "transfer",
      { agentId: third.user.id },
      first.conversationId,
    );
    expect(
      (
        await scoped(courseId, w, (tx) =>
          conversation(tx, w, first.conversationId),
        )
      ).agentId,
    ).toBe(agent.user.id);
    await act(third, "accept_transfer", {}, first.conversationId);
    expect(
      (
        await scoped(courseId, w, (tx) =>
          conversation(tx, w, first.conversationId),
        )
      ).agentId,
    ).toBe(third.user.id);
    await act(admin, "presence", { status: "AVAILABLE" });
    await act(admin, "takeover", {}, first.conversationId);
    expect(
      (
        await scoped(courseId, w, (tx) =>
          conversation(tx, w, first.conversationId),
        )
      ).agentId,
    ).toBe(admin.user.id);
  });
  it("separates released QA feedback from private coaching and customer rating", async () => {
    const id = customers.get("first")!.conversationId;
    await act(
      admin,
      "evaluate",
      {
        agentId: agent.user.id,
        scores: {
          accuracy: 28,
          communication: 23,
          procedure: 18,
          response: 12,
          documentation: 9,
        },
        feedback: "Good empathy",
        privateNote: "Teacher only",
        released: true,
      },
      id,
    );
    const v = (await read(
      agent,
      w,
      new URLSearchParams({ kind: "conversation", id }),
    )) as { evaluations: { privateNote?: string; total: number }[] };
    expect(v.evaluations[0].total).toBe(90);
    expect(v.evaluations[0].privateNote).toBeUndefined();
  });
  it("revokes only chat access on batch completion and retains history", async () => {
    const jwt = await signJWT(agent.user);
    const request = new NextRequest(
      "http://" + slug + ".localhost/api/live-chat",
      { headers: { host: slug + ".localhost", cookie: "__session=" + jwt } },
    );
    await expect(chatIdentity(request)).resolves.toBeTruthy();
    await prisma.batchStudent.updateMany({
      where: { courseId, roll: agent.user.studentRoll! },
      data: { courseStatus: "Completed" },
    });
    await expect(chatIdentity(request)).rejects.toThrow(
      "Live Chat access ends",
    );
    expect(
      await scoped(courseId, w, (tx) => tx.chatMessage.count()),
    ).toBeGreaterThan(0);
    const { identity } = await import("@/lib/customer-service/access");
    await expect(identity(request)).resolves.toBeTruthy();
  });
  it("does not duplicate a customer session when the initial response is retried", async () => {
    const requestId = randomUUID(),
      data = {
        name: "Retry customer",
        categoryId,
        text: "Please check my order",
        requestId,
      };
    const first = (await publicMutate(req(), token, {
      action: "start",
      data,
    })) as { id: string; cookie: { value: string } };
    const second = (await publicMutate(req(), token, {
      action: "start",
      data,
    })) as { id: string; cookie: { value: string } };
    expect(second.id).toBe(first.id);
    expect(second.cookie.value).toBe(first.cookie.value);
  });
  it("binds a customer session to its own public link and rejects paused entry", async () => {
    const current = await start("link-bound");
    const link = (await act(admin, "link", { hours: 24 })) as {
      id: string;
      path: string;
    };
    const otherToken = link.path.split("/").pop()!;
    const foreignCookie = "lc_" + link.id + "=" + current.cookie.split("=")[1];
    await expect(
      publicRead(
        new NextRequest(req().url + "?kind=conversation", {
          headers: {
            ...Object.fromEntries(req().headers),
            cookie: foreignCookie,
          },
        }),
        otherToken,
      ),
    ).rejects.toThrow("expired");
    await act(admin, "link_state", { active: false }, link.id);
    await expect(
      publicMutate(req(), otherToken, {
        action: "start",
        data: {
          name: "Blocked",
          categoryId,
          text: "hello",
          requestId: randomUUID(),
        },
      }),
    ).rejects.toThrow("paused");
  });
  it("creates a re-copyable permanent link and renew retires the previous one", async () => {
    const first = (await act(admin, "link", { permanent: true })) as {
      id: string;
      path: string;
    };
    type Links = {
      links: {
        id: string;
        active: boolean;
        permanent: boolean;
        path: string | null;
        tokenHash?: string;
      }[];
    };
    let state = (await read(admin, w, new URLSearchParams())) as Links;
    const listed = state.links.find((l) => l.id === first.id)!;
    expect(listed.permanent).toBe(true);
    expect(listed.path).toBe(first.path);
    expect(listed.tokenHash).toBeUndefined();
    // Students never receive links.
    expect(
      ((await read(agent, w, new URLSearchParams())) as Links).links,
    ).toEqual([]);
    const firstToken = first.path.split("/").pop()!;
    const welcome = (await publicRead(
      new NextRequest(req().url.replace(token, firstToken) + "?kind=welcome", {
        headers: Object.fromEntries(req().headers),
      }),
      firstToken,
    )) as { linkOpen: boolean; agentsOnline: boolean; categories: unknown[] };
    expect(welcome.linkOpen).toBe(true);
    expect(typeof welcome.agentsOnline).toBe("boolean");
    expect(JSON.stringify(welcome)).not.toMatch(/@|userId|email/);
    // Session links cannot be permanent.
    await expect(
      act(admin, "link", { permanent: true, sessionId: randomUUID() }),
    ).rejects.toThrow("expiry");
    const second = (await act(admin, "link", { permanent: true })) as {
      id: string;
      path: string;
    };
    expect(second.path).not.toBe(first.path);
    state = (await read(admin, w, new URLSearchParams())) as Links;
    expect(state.links.find((l) => l.id === first.id)!.active).toBe(false);
    expect(state.links.find((l) => l.id === second.id)!.active).toBe(true);
    await expect(
      publicMutate(req(), firstToken, {
        action: "start",
        data: { name: "Old", categoryId, text: "hi", requestId: randomUUID() },
      }),
    ).rejects.toThrow("paused");
    // Honeypot submissions are rejected and create no conversation.
    await expect(
      publicMutate(req(), second.path.split("/").pop()!, {
        action: "start",
        data: {
          name: "Bot",
          categoryId,
          text: "spam",
          requestId: randomUUID(),
          website: "http://spam.example",
        },
      }),
    ).rejects.toThrow("Unable to start chat");
    await act(admin, "link_state", { active: false }, second.id);
  });
  it("isolates assessment references and preserves the scoring policy snapshot", async () => {
    const session = (await act(admin, "session", {
      name: "Assessment",
      mode: "ASSESSMENT",
      scenario: "Teacher-only refund scenario",
      participants: [second.user.id],
      hints: false,
      startsAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 3600000),
      passMark: 75,
    })) as { id: string; rubric: unknown };
    const state = (await read(second, w, new URLSearchParams())) as {
      references: unknown[];
      sessions: { id: string; scenario: string }[];
    };
    expect(state.references).toEqual([]);
    expect(state.sessions.find((s) => s.id === session.id)?.scenario).toBe("");
    await act(admin, "settings", {
      ...((await read(admin, w, new URLSearchParams())) as { settings: object })
        .settings,
      passMark: 50,
    });
    const stored = await scoped(courseId, w, (tx) =>
      tx.chatTrainingSession.findFirstOrThrow({ where: { id: session.id } }),
    );
    expect(stored.passMark).toBe(75);
    expect(stored.rubric).toEqual(session.rubric);
    await act(
      admin,
      "session_state",
      { state: "CLOSED", released: false },
      session.id,
    );
  });
  it("redacts private messages and customer identity from class demonstrations", async () => {
    const id = customers.get("first")!.conversationId;
    const session = (await act(admin, "session", {
      name: "Demonstration",
      mode: "DEMONSTRATION",
      scenario: "Observe the handling",
      participants: [],
      hints: true,
      startsAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 3600000),
      passMark: 70,
    })) as { id: string };
    await act(admin, "demonstrate", { sessionId: session.id }, id);
    const v = (await read(
      second,
      w,
      new URLSearchParams({ kind: "demonstration", sessionId: session.id }),
    )) as { messages: { text: string; senderName: string }[] };
    expect(v.messages.length).toBeGreaterThan(0);
    expect(
      v.messages.some(
        (m) => m.text.includes("Coaching") || m.text.includes("Private"),
      ),
    ).toBe(false);
    expect(
      v.messages.every((m) =>
        ["Training customer", "Agent", "System"].includes(m.senderName),
      ),
    ).toBe(true);
  });
  it("handles a simultaneous 60-agent / 60-customer local workload without duplicate ownership", async () => {
    await scoped(courseId, w, async (tx) => {
      await tx.chatConversation.updateMany({
        where: {
          workspaceId: w,
          status: { in: ["QUEUED", "ASSIGNED", "ACTIVE"] },
        },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      await tx.chatAssignment.updateMany({
        where: { workspaceId: w, endedAt: null },
        data: { endedAt: new Date() },
      });
      await tx.chatAgentState.updateMany({
        where: { workspaceId: w },
        data: { status: "OFFLINE" },
      });
      const people = Array.from({ length: 60 }, (_, i) => ({
        userId: "load-" + suffix + "-" + i,
        name: "Load Agent " + i,
      }));
      await tx.member.createMany({
        data: people.map((p) => ({
          courseId,
          workspaceId: w,
          userId: p.userId,
          role: "AGENT",
        })),
      });
      await tx.chatAgentState.createMany({
        data: people.map((p) => ({
          ...p,
          courseId,
          workspaceId: w,
          status: "AVAILABLE",
          heartbeatAt: new Date(),
        })),
      });
    });
    const started = Date.now(),
      load = await Promise.all(
        Array.from({ length: 60 }, (_, i) => start("load-customer-" + i)),
      );
    const rows = await scoped(courseId, w, (tx) =>
      tx.chatConversation.findMany({
        where: {
          workspaceId: w,
          id: { in: load.map((c) => c.conversationId) },
        },
      }),
    );
    expect(rows).toHaveLength(60);
    expect(rows.every((r) => r.status === "ASSIGNED")).toBe(true);
    expect(new Set(rows.map((r) => r.agentId)).size).toBe(60);
    const open = await scoped(courseId, w, (tx) =>
      tx.chatAssignment.count({
        where: {
          workspaceId: w,
          conversationId: { in: rows.map((c) => c.id) },
          endedAt: null,
        },
      }),
    );
    expect(open).toBe(60);
    await scoped(courseId, w, async (tx) => {
      await tx.chatConversation.createMany({
        data: Array.from({ length: 180 }, (_, i) => ({
          courseId,
          workspaceId: w,
          categoryId,
          customerSessionId: rows[i % 60].customerSessionId,
          customerName: "Saturation " + i,
          status: "QUEUED",
        })),
      });
      const { defaults } = await import("./domain");
      await dispatch(tx, { courseId, workspaceId: w }, defaults);
    });
    const saturated = await scoped(courseId, w, (tx) =>
      tx.chatConversation.groupBy({
        by: ["agentId"],
        where: { workspaceId: w, status: "ASSIGNED" },
        _count: true,
      }),
    );
    expect(saturated).toHaveLength(60);
    expect(saturated.every((g) => g._count === 3)).toBe(true);
    expect(
      await scoped(courseId, w, (tx) =>
        tx.chatConversation.count({
          where: { workspaceId: w, status: "QUEUED" },
        }),
      ),
    ).toBe(60);
    console.info(
      "Local 60-agent/60-customer assignment workload:",
      Date.now() - started,
      "ms",
    );
  }, 30000);
  it("resumes more than 100 messages without gaps, even with identical timestamps", async () => {
    const target = await start("cursor-check");
    await scoped(courseId, w, (tx) =>
      tx.chatMessage.createMany({
        data: Array.from({ length: 125 }, (_, i) => ({
          courseId,
          workspaceId: w,
          conversationId: target.conversationId,
          senderId: "fixture",
          senderName: "Customer",
          sender: "CUSTOMER",
          text: "Message " + i,
          requestId: randomUUID(),
          createdAt: new Date("2026-11-05T00:00:00Z"),
        })),
      }),
    );
    type Page = { messages: { id: string }[]; hasMore: boolean };
    const get = (suffix: string) =>
      publicRead(
        new NextRequest(
          req(target.cookie).url + "?kind=conversation" + suffix,
          { headers: req(target.cookie).headers },
        ),
        token,
      ) as Promise<Page>;
    const latest = await get(""),
      previous = await get("&before=" + latest.messages[0].id),
      after = await get("&after=" + previous.messages.at(-1)!.id);
    expect(latest.messages).toHaveLength(100);
    expect(previous.messages).toHaveLength(26);
    expect(previous.hasMore).toBe(false);
    expect(after.messages.map((m) => m.id)).toEqual(
      latest.messages.map((m) => m.id),
    );
    expect(
      new Set([...previous.messages, ...latest.messages].map((m) => m.id)).size,
    ).toBe(126);
  });
  it("preserves original acceptance after transfer and excludes open handling from AHT", async () => {
    const target = await start("report-timing"),
      now = Date.now(),
      begin = new Date(now - 120000),
      accept = new Date(now - 100000),
      transfer = new Date(now - 50000);
    await scoped(courseId, w, async (tx) => {
      await tx.chatAssignment.updateMany({
        where: {
          workspaceId: w,
          conversationId: target.conversationId,
          endedAt: null,
        },
        data: { endedAt: begin },
      });
      await tx.chatConversation.update({
        where: { id: target.conversationId },
        data: {
          queueAt: begin,
          createdAt: begin,
          acceptedAt: transfer,
          firstReplyAt: new Date(now - 90000),
          status: "ACTIVE",
          agentId: second.user.id,
        },
      });
      await tx.chatAssignment.createMany({
        data: [
          {
            courseId,
            workspaceId: w,
            conversationId: target.conversationId,
            agentId: agent.user.id,
            startedAt: begin,
            acceptedAt: accept,
            firstReplyAt: new Date(now - 90000),
            endedAt: transfer,
          },
          {
            courseId,
            workspaceId: w,
            conversationId: target.conversationId,
            agentId: second.user.id,
            startedAt: transfer,
            acceptedAt: transfer,
            firstReplyAt: new Date(now - 40000),
          },
        ],
      });
    });
    const result = await scoped(courseId, w, async (tx) => {
      const { report } = await import("./service");
      return report(
        tx,
        admin,
        w,
        new URLSearchParams({
          from: new Date(now - 180000).toISOString(),
          to: new Date(now + 86400000).toISOString(),
          agentId: second.user.id,
          status: "ACTIVE",
        }),
      );
    });
    expect(result.metrics.queueWait).toBe(20);
    expect(result.metrics.aht).toBeNull();
    expect(result.agents.every((a) => a.handleSeconds < 86400)).toBe(true);
  });
  it("recovers worker state idempotently and never resolves abandoned chats", async () => {
    const target = await start("worker-recovery");
    await scoped(courseId, w, async (tx) => {
      const c = await conversation(tx, w, target.conversationId);
      await tx.chatCustomerSession.update({
        where: { id: c.customerSessionId },
        data: { heartbeatAt: new Date(Date.now() - 7200000) },
      });
      await tick(tx, { courseId, workspaceId: w });
      await tick(tx, { courseId, workspaceId: w });
    });
    const c = await scoped(courseId, w, (tx) =>
      conversation(tx, w, target.conversationId),
    );
    expect(c.status).toBe("ABANDONED");
    expect(c.resolvedAt).toBeNull();
    expect(
      await scoped(courseId, w, (tx) =>
        tx.chatEvent.count({
          where: {
            workspaceId: w,
            conversationId: c.id,
            type: "customer_disconnected",
          },
        }),
      ),
    ).toBe(1);
  });
  it("loads 60 pending practice cases exactly once and preserves completed work", async () => {
    const first = await prepareWorkspace(admin, w);
    expect(first.added).toBe(60);
    const secondLoad = await prepareWorkspace(admin, w);
    expect(secondLoad.added).toBe(0);
    const cases = await scoped(courseId, w, (tx) =>
      tx.chatConversation.findMany({
        where: { workspaceId: w, practiceKey: { not: null } },
      }),
    );
    expect(cases).toHaveLength(60);
    expect(cases.every((c) => c.status === "QUEUED" && !c.agentId)).toBe(true);
    expect(
      cases.some(
        (c) => (c.practiceScript as { language: string }).language === "bn",
      ),
    ).toBe(true);
    const chosen = cases[0];
    await scoped(courseId, w, (tx) =>
      tx.chatConversation.update({
        where: { id: chosen.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          resolution: "PRACTICE_COMPLETED",
        },
      }),
    );
    await prepareWorkspace(admin, w);
    expect(
      (await scoped(courseId, w, (tx) => conversation(tx, w, chosen.id)))
        .resolution,
    ).toBe("PRACTICE_COMPLETED");
  });
  it("lets a trainee start a pending practice and receives persisted scripted customer replies", async () => {
    const c = await scoped(courseId, w, (tx) =>
      tx.chatConversation.findFirstOrThrow({
        where: {
          workspaceId: w,
          practiceKey: { not: null },
          practiceStartedAt: null,
          status: "QUEUED",
        },
      }),
    );
    await act(second, "claim_practice", {}, c.id);
    const message = {
      text: "Hello, I will check your request. Please share the training reference.",
      requestId: randomUUID(),
    };
    await act(second, "message", message, c.id);
    await act(second, "message", message, c.id);
    const saved = await scoped(courseId, w, (tx) => conversation(tx, w, c.id));
    expect(saved.practiceStep).toBe(1);
    expect(saved.agentId).toBe(second.user.id);
    expect(saved.practiceStartedAt).toBeTruthy();
    expect(
      await scoped(courseId, w, (tx) =>
        tx.chatMessage.count({
          where: { workspaceId: w, conversationId: c.id, sender: "CUSTOMER" },
        }),
      ),
    ).toBe(2);
    await expect(act(third, "claim_practice", {}, c.id)).rejects.toThrow();
  });
  it("keeps unopened practice cases pending and does not auto-assign them by default", async () => {
    const c = await scoped(courseId, w, (tx) =>
      tx.chatConversation.findFirstOrThrow({
        where: {
          workspaceId: w,
          practiceKey: { not: null },
          practiceStartedAt: null,
          status: "QUEUED",
        },
      }),
    );
    await scoped(courseId, w, async (tx) => {
      await tx.chatConversation.update({
        where: { id: c.id },
        data: { queueAt: new Date(Date.now() - 7 * 86400000) },
      });
      await tx.chatCustomerSession.update({
        where: { id: c.customerSessionId },
        data: { heartbeatAt: new Date(Date.now() - 7 * 86400000) },
      });
      await tick(tx, { courseId, workspaceId: w });
    });
    const pending = await scoped(courseId, w, (tx) =>
      conversation(tx, w, c.id),
    );
    expect(pending.status).toBe("QUEUED");
    expect(pending.practiceStartedAt).toBeNull();
    const otherWorkspace = await scoped(courseId, "", (tx) =>
      tx.workspace.create({
        data: {
          courseId,
          batchId: "other-" + randomUUID(),
          name: "Other practice batch",
        },
      }),
    );
    await scoped(courseId, otherWorkspace.id, async (tx) => {
      const { seedPractice } =
        await import("../../../scripts/lib/live-chat-practice.cjs");
      await seedPractice(tx, { courseId, workspaceId: otherWorkspace.id }, {});
    });
    expect(
      await scoped(courseId, otherWorkspace.id, (tx) =>
        tx.chatConversation.count({
          where: { workspaceId: otherWorkspace.id, practiceKey: { not: null } },
        }),
      ),
    ).toBe(60);
    await expect(
      read(second, otherWorkspace.id, new URLSearchParams()),
    ).rejects.toThrow("Workspace access denied");
  });
});
