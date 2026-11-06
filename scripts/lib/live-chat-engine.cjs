// Shared by Next route handlers and the standalone durable worker. No credentials here.
const ACTIVE = ["ASSIGNED", "ACTIVE"];
const DEFAULTS = {
  capacity: 3,
  acceptSeconds: 30,
  firstReplySeconds: 60,
  nextReplySeconds: 60,
  disconnectSeconds: 60,
  warningSeconds: 300,
  closeSeconds: 600,
  queueSeconds: 900,
};
const scope = (courseId, workspaceId) => ({ courseId, workspaceId });
async function lock(tx, workspaceId) {
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    "live-chat:" + workspaceId,
  );
}
async function event(tx, s, actorId, type, conversationId = null, data = {}) {
  await tx.chatEvent.create({
    data: { ...s, actorId, type, conversationId, data },
  });
}
async function finishAssignments(tx, s, conversationId, now = new Date()) {
  await tx.chatAssignment.updateMany({
    where: { workspaceId: s.workspaceId, conversationId, endedAt: null },
    data: { endedAt: now },
  });
}
async function dispatch(tx, s, config = DEFAULTS, excluded = []) {
  await lock(tx, s.workspaceId);
  const now = new Date();
  const waiting = await tx.chatConversation.findMany({
    where: { workspaceId: s.workspaceId, status: "QUEUED" },
    orderBy: [{ queueAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  // Fetch eligibility and workload once. Recounting every agent for every queued
  // chat turns a full classroom queue into thousands of queries per tick.
  const pool = await tx.chatAgentState.findMany({
    where: {
      workspaceId: s.workspaceId,
      status: "AVAILABLE",
      heartbeatAt: { gte: new Date(+now - config.disconnectSeconds * 1000) },
      userId: { notIn: excluded },
    },
    orderBy: [{ lastAssignedAt: "asc" }, { userId: "asc" }],
  });
  const members = await tx.member.findMany({
    where: { workspaceId: s.workspaceId, active: true },
    select: { userId: true },
  });
  const eligible = new Set(members.map((m) => m.userId));
  const agents = pool.filter((a) => eligible.has(a.userId));
  const workload = await tx.chatConversation.groupBy({
    by: ["agentId"],
    where: { workspaceId: s.workspaceId, status: { in: ACTIVE } },
    _count: true,
  });
  const counts = new Map(workload.map((c) => [c.agentId, c._count]));
  for (const c of waiting) {
    if (c.practiceKey && !config.practiceAutoAssign) continue;
    const session = c.sessionId
      ? await tx.chatTrainingSession.findUnique({
          where: {
            workspaceId_id: { workspaceId: s.workspaceId, id: c.sessionId },
          },
        })
      : null;
    if (
      session &&
      (session.state !== "OPEN" ||
        session.startsAt > now ||
        (session.endsAt && session.endsAt <= now))
    )
      continue;
    const index = agents.findIndex(
      (a) =>
        (counts.get(a.userId) || 0) < config.capacity &&
        (!session?.participants.length ||
          session.participants.includes(a.userId)),
    );
    if (index < 0) continue;
    const selected = agents.splice(index, 1)[0];
    agents.push(selected);
    counts.set(selected.userId, (counts.get(selected.userId) || 0) + 1);
    await tx.chatConversation.update({
      where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
      data: {
        agentId: selected.userId,
        status: "ASSIGNED",
        assignedAt: now,
        ...(c.practiceKey && !c.practiceStartedAt
          ? { practiceStartedAt: now, queueAt: now, unansweredAt: now }
          : {}),
      },
    });
    await tx.chatAssignment.create({
      data: {
        ...s,
        conversationId: c.id,
        agentId: selected.userId,
        startedAt: now,
      },
    });
    await tx.chatAgentState.update({
      where: {
        workspaceId_userId: {
          workspaceId: s.workspaceId,
          userId: selected.userId,
        },
      },
      data: { lastAssignedAt: now },
    });
    await event(tx, s, "system", "assigned", c.id, {
      agentId: selected.userId,
    });
  }
}
async function tick(tx, s, options = {}) {
  await lock(tx, s.workspaceId);
  const now = new Date();
  const row = await tx.chatSettings.findUnique({
    where: { workspaceId: s.workspaceId },
  });
  const cfg = { ...DEFAULTS, ...(row?.value || {}) };
  const agents = await tx.chatAgentState.findMany({
    where: { workspaceId: s.workspaceId, status: { not: "OFFLINE" } },
  });
  const absent = [];
  for (const a of agents) {
    if (
      +now - +a.heartbeatAt <= cfg.disconnectSeconds * 1000 &&
      !options.disable &&
      !options.ineligible?.includes(a.userId)
    )
      continue;
    await tx.chatAgentState.update({
      where: {
        workspaceId_userId: { workspaceId: s.workspaceId, userId: a.userId },
      },
      data: { status: "OFFLINE", statusAt: now },
    });
    absent.push(a.userId);
    await event(tx, s, a.userId, "availability", null, {
      status: "OFFLINE",
      reason: options.disable
        ? "batch_or_feature_closed"
        : "heartbeat_or_enrollment",
    });
  }
  const chats = await tx.chatConversation.findMany({
    where: {
      workspaceId: s.workspaceId,
      status: { in: ["QUEUED", ...ACTIVE] },
    },
    take: 1000,
  });
  for (const c of chats) {
    const policy = { ...cfg, ...(c.policySnapshot || {}) };
    if (
      c.unansweredAt &&
      +now - +c.unansweredAt >
        (c.firstReplyAt ? policy.nextReplySeconds : policy.firstReplySeconds) *
          1000
    ) {
      const waitingSince = c.unansweredAt.toISOString();
      if (
        !(await tx.chatEvent.findFirst({
          where: {
            workspaceId: s.workspaceId,
            conversationId: c.id,
            type: "response_overdue",
            data: { path: ["waitingSince"], equals: waitingSince },
          },
        }))
      )
        await event(tx, s, "system", "response_overdue", c.id, {
          waitingSince,
          agentId: c.agentId,
        });
    }
    const customer = await tx.chatCustomerSession.findFirst({
      where: { workspaceId: s.workspaceId, id: c.customerSessionId },
    });
    if (
      !c.practiceKey &&
      customer &&
      +now - +customer.heartbeatAt > policy.disconnectSeconds * 1000
    ) {
      const connection = await tx.chatEvent.findFirst({
        where: {
          workspaceId: s.workspaceId,
          conversationId: c.id,
          type: { in: ["disconnected", "reconnected"] },
        },
        orderBy: { id: "desc" },
      });
      if (connection?.type !== "disconnected")
        await event(tx, s, customer.id, "disconnected", c.id);
    }
    const session = c.sessionId
      ? await tx.chatTrainingSession.findUnique({
          where: {
            workspaceId_id: { workspaceId: s.workspaceId, id: c.sessionId },
          },
        })
      : null;
    const ended =
      session &&
      (session.state !== "OPEN" || (session.endsAt && session.endsAt <= now));
    const sessionClosed = options.disable || ended;
    const noAcceptance =
      c.status === "ASSIGNED" &&
      +now - +c.assignedAt > policy.acceptSeconds * 1000;
    const assignment = c.agentId
      ? await tx.chatAssignment.findFirst({
          where: {
            workspaceId: s.workspaceId,
            conversationId: c.id,
            agentId: c.agentId,
            endedAt: null,
          },
        })
      : null;
    const noReply =
      c.status === "ACTIVE" &&
      assignment?.acceptedAt &&
      !assignment.firstReplyAt &&
      +now - +assignment.acceptedAt > policy.firstReplySeconds * 1000;
    if (sessionClosed) {
      await finishAssignments(tx, s, c.id, now);
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
        data: {
          status: "CLOSED",
          closedAt: now,
          resolution: "SESSION_ENDED",
          transferTo: null,
          transferAt: null,
        },
      });
      await event(tx, s, "system", "closed", c.id, {
        reason: "session_or_batch_ended",
      });
    } else if (
      !c.practiceKey &&
      customer &&
      +now - +customer.heartbeatAt > policy.closeSeconds * 1000
    ) {
      await finishAssignments(tx, s, c.id, now);
      await tx.chatConversation.update({
        where: { id: c.id },
        data: {
          status: c.firstReplyAt ? "DROPPED" : "ABANDONED",
          closedAt: now,
          resolution: "CUSTOMER_DISCONNECTED",
          transferTo: null,
          transferAt: null,
        },
      });
      await event(tx, s, "system", "customer_disconnected", c.id, {
        answered: !!c.firstReplyAt,
      });
    } else if (
      c.agentId &&
      (absent.includes(c.agentId) ||
        options.ineligible?.includes(c.agentId) ||
        noAcceptance ||
        noReply)
    ) {
      await finishAssignments(tx, s, c.id, now);
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
        data: {
          status: "QUEUED",
          agentId: null,
          assignedAt: null,
          acceptedAt: null,
          transferTo: null,
          transferAt: null,
        },
      });
      // Prevent immediately reassigning an unanswered conversation to the same agent.
      await tx.chatAgentState.updateMany({
        where: {
          workspaceId: s.workspaceId,
          userId: c.agentId,
          status: { not: "OFFLINE" },
        },
        data: { status: "BUSY", statusAt: now },
      });
      if (!absent.includes(c.agentId))
        await event(tx, s, c.agentId, "availability", null, {
          status: "BUSY",
          reason: "unanswered",
        });
      await event(tx, s, "system", "requeued", c.id, {
        previousAgent: c.agentId,
        reason: "unanswered_or_disconnected",
      });
    } else if (
      c.status === "QUEUED" &&
      (!c.practiceKey || c.practiceStartedAt) &&
      +now - +c.queueAt > policy.queueSeconds * 1000
    ) {
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
        data: {
          status: c.firstReplyAt ? "DROPPED" : "ABANDONED",
          closedAt: now,
          resolution: "QUEUE_TIMEOUT",
        },
      });
      await event(tx, s, "system", "queue_timeout", c.id);
    } else if (
      c.status === "ACTIVE" &&
      !c.unansweredAt &&
      +now - +c.lastCustomerAt > policy.closeSeconds * 1000
    ) {
      await finishAssignments(tx, s, c.id, now);
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
        data: {
          status: "CLOSED",
          closedAt: now,
          resolution: "CUSTOMER_INACTIVE",
          transferTo: null,
          transferAt: null,
        },
      });
      await event(tx, s, "system", "closed", c.id, {
        reason: "customer_inactive",
      });
    } else if (
      c.status === "ACTIVE" &&
      !c.unansweredAt &&
      !c.warned &&
      +now - +c.lastCustomerAt > policy.warningSeconds * 1000
    ) {
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
        data: { warned: true },
      });
      await tx.chatMessage.create({
        data: {
          ...s,
          conversationId: c.id,
          senderId: "system",
          senderName: "System",
          sender: "SYSTEM",
          text: "Are you still there? / আপনি কি এখনও আছেন?",
          requestId: "inactivity:" + c.lastCustomerAt.toISOString(),
        },
      });
      await event(tx, s, "system", "inactivity_warning", c.id);
    }
    if (c.transferAt && +now - +c.transferAt > policy.acceptSeconds * 1000) {
      await tx.chatConversation.update({
        where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
        data: { transferTo: null, transferAt: null },
      });
      await event(tx, s, "system", "transfer_expired", c.id);
    }
  }
  if (!options.disable) await dispatch(tx, s, cfg, options.ineligible || []);
  await tx.chatRateBucket.deleteMany({
    where: { workspaceId: s.workspaceId, expiresAt: { lt: now } },
  });
}
module.exports = {
  ACTIVE,
  DEFAULTS,
  scope,
  lock,
  event,
  finishAssignments,
  dispatch,
  tick,
};
