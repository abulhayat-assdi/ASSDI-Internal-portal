import fs from "node:fs";
import assert from "node:assert/strict";
const container = process.env.INCUBATION_CONTAINER_TEST === "1";
const port = container ? 3106 : 3105;
const c = JSON.parse(
  fs.readFileSync(
    ".incubation-test/" +
      (container ? "container-preview" : "preview") +
      ".json",
    "utf8",
  ),
);
assert.equal(c.origin, "http://incubation.localhost:" + port);
const headers = (token) => ({
  host: "incubation.localhost:" + port,
  "x-forwarded-host": "incubation.localhost:" + port,
  ...(token ? { cookie: "__session=" + token } : {}),
});
const raw = (url, token = c.adminToken, body, method = body ? "POST" : "GET") =>
  fetch("http://127.0.0.1:" + port + url, {
    method,
    headers: {
      ...headers(token),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const ok = async (url, token, body, method) => {
  const r = await raw(url, token, body, method);
  const d = await r.json();
  assert.ok(r.ok, url + ": " + JSON.stringify(d));
  return d;
};
const command = (action, payload, token = c.adminToken, pid = c.programId) =>
  ok("/api/incubation", token, {
    action,
    programId: pid || undefined,
    payload,
  });
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
}).format(new Date());
assert.ok(
  c.memberToken && c.teacherToken && c.targetToken,
  "Run the four-role disposable fixture first",
);
const lead = await ok(
  "/api/incubation?programId=" + c.programId,
  c.studentToken,
);
assert.equal(lead.capabilities.finance, true);
const denied = await raw("/api/incubation", c.memberToken, {
  action: "record",
  programId: c.programId,
  payload: {
    teamId: c.teamId,
    kind: "sale",
    date: today,
    requestKey: crypto.randomUUID(),
    data: {
      lines: [{ productId: c.productId, quantity: "1", unitPrice: "150" }],
      areaId: c.areaId,
    },
  },
});
assert.equal(denied.status, 403);
assert.equal(
  (
    await raw(
      "/api/incubation/export?programId=" + c.programId + "&format=xlsx",
      c.memberToken,
    )
  ).status,
  403,
);
assert.equal(
  (await raw("/api/incubation/files/" + c.voucherId, c.memberToken)).status,
  403,
);
const privateFund = await command(
  "record",
  {
    teamId: c.targetTeamId,
    kind: "fund",
    date: today,
    requestKey: crypto.randomUUID(),
    data: { amount: "1000", round: "Round A", note: "PRIVATE_TEAM_B_CANARY" },
  },
  c.teacherToken,
);
const learner = await command(
  "record",
  {
    teamId: c.teamId,
    kind: "fgd",
    date: today,
    requestKey: crypto.randomUUID(),
    data: {
      findings: ["One useful finding"],
      actions: ["One concrete action"],
    },
  },
  c.memberToken,
);
assert.equal(learner.status, "posted");
assert.equal(
  (
    await raw("/api/incubation", c.studentToken, {
      action: "correct",
      programId: c.programId,
      payload: {
        recordId: learner.id,
        version: 1,
        date: today,
        data: { findings: ["Changed by leader"], actions: ["Not the author"] },
        reason: "Cannot edit another member personal entry",
        void: false,
      },
    })
  ).status,
  403,
);
for (const token of [c.studentToken, c.memberToken]) {
  const b = await ok("/api/incubation?programId=" + c.programId, token);
  assert.ok(!JSON.stringify(b).includes("PRIVATE_TEAM_B_CANARY"));
  assert.ok(b.teams.every((t) => t.id === c.teamId));
  assert.ok(b.ledger.summaries.every((t) => t.teamId === c.teamId));
  assert.ok(!b.records.some((r) => r.id === privateFund.id));
  if (token === c.memberToken) {
    assert.ok(
      b.records.every(
        (r) =>
          ["fgd", "insight"].includes(r.kind) && r.enteredBy === b.actor.id,
      ),
    );
    assert.equal(b.transferTeams.length, 0);
  }
  const otherEdit = await raw("/api/incubation", token, {
    action: "correct",
    programId: c.programId,
    payload: {
      recordId: privateFund.id,
      version: 1,
      date: today,
      data: { amount: "2000" },
      reason: "Unauthorized edit",
      void: false,
    },
  });
  assert.equal(otherEdit.status, 403);
}
const position = () => ({
  latitude: 23.8,
  longitude: 90.4,
  accuracy: 12,
  capturedAt: new Date().toISOString(),
});
const field = await ok("/api/incubation/field", c.targetToken, {
  action: "checkin",
  programId: c.programId,
  areaId: c.areaId,
  position: position(),
  carried: [],
});
await ok("/api/incubation/field", c.targetToken, {
  action: "checkout",
  programId: c.programId,
  areaId: c.areaId,
  position: position(),
  steps: 123,
});
assert.equal(
  (
    await raw(
      "/api/incubation/field?programId=" +
        c.programId +
        "&sessionId=" +
        field.session.id,
      c.studentToken,
    )
  ).status,
  403,
);
assert.ok(
  (
    await ok(
      "/api/incubation/field?programId=" +
        c.programId +
        "&sessionId=" +
        field.session.id,
      c.teacherToken,
    )
  ).positions.length,
);
const teacher = await ok(
  "/api/incubation?programId=" + c.programId,
  c.teacherToken,
);
assert.equal(teacher.manager, true);
assert.ok(teacher.records.some((r) => r.id === privateFund.id));
const settings = {
  ...teacher.program.settings,
  sprintDays: 3,
  sessions: ["Morning", "Afternoon"],
  sessionsRequired: true,
};
const created = await command(
  "program",
  {
    name: "Teacher-created Market Lab",
    description: "Full teacher management",
    startDate: today,
    endDate: null,
    batchNames: ["Sales Batch 12"],
    staffIds: [],
    status: "active",
    settings,
  },
  c.teacherToken,
  "",
);
assert.ok(created.competitionId);
await command(
  "catalog",
  {
    kind: "category",
    name: "Teacher category",
    parentId: null,
    unit: "piece",
    fractional: false,
    active: true,
  },
  c.teacherToken,
  created.id,
);
assert.equal(
  (await raw("/api/incubation?programId=" + created.id, c.studentToken)).status,
  403,
);
assert.equal(
  (
    await raw(
      "/api/student/competitions/" + created.competitionId,
      c.studentToken,
    )
  ).status,
  403,
);
const directory = await ok("/api/student/competitions", c.studentToken);
assert.ok(
  directory.competitions.find((v) => v.id === c.competitionId && v.canOpen),
);
assert.equal(
  directory.competitions.find((v) => v.id === created.competitionId).canOpen,
  false,
);
assert.equal((await raw("/api/competitions", c.studentToken)).status, 403);
assert.equal(
  (
    await raw(
      "/api/student/competitions/" + c.competitionId + "/submit",
      c.studentToken,
      { data: {}, reportDate: today },
    )
  ).status,
  404,
);
assert.equal(
  (
    await raw(
      "/api/competitions/" + c.competitionId + "/report?public=true",
      c.studentToken,
    )
  ).status,
  404,
);
assert.ok(
  !(
    await raw(
      "/api/competitions/" + c.competitionId,
      c.adminToken,
      {},
      "DELETE",
    )
  ).ok,
);
assert.ok(
  (await ok("/api/incubation?programId=" + c.programId, c.adminToken)).program
    .id,
);
const publicData = await ok("/api/incubation/public/" + c.publicToken, null);
assert.ok(publicData.summaries.length >= 2 && publicData.totals);
for (const word of [
  "PRIVATE_TEAM_B_CANARY",
  c.voucherId,
  "latitude",
  "requestedBy",
  "password",
])
  assert.ok(!JSON.stringify(publicData).includes(word));
assert.equal(
  (
    await raw("/api/incubation/public/" + c.publicToken, c.adminToken, {
      action: "share",
    })
  ).status,
  405,
);
const existingGroups = await ok(
  "/api/competitions/groups?batchName=" + encodeURIComponent("Sales Batch 12"),
  c.adminToken,
);
const group =
  existingGroups.find(
    (g) =>
      g.members.some((m) => m.roll === "1" && m.isLeader) &&
      g.members.some((m) => m.roll === "2"),
  ) ||
  (await ok("/api/competitions/groups", c.adminToken, {
    batchName: "Sales Batch 12",
    groupName: "Reusable roster " + crypto.randomUUID(),
    members: [
      { roll: "1", name: "Team Leader" },
      { roll: "2", name: "Team Member" },
    ],
    leaderRoll: "1",
  }));
assert.ok(
  (
    await ok("/api/incubation?programId=" + created.id, c.teacherToken)
  ).groupTemplates.some((g) => g.id === group.id),
);
assert.equal(
  (await ok("/api/incubation?programId=" + c.programId, c.memberToken))
    .groupTemplates.length,
  0,
);
const form = await ok("/api/competitions", c.adminToken, {
  title: "Legacy form regression",
  batchName: "Sales Batch 12",
  schema: [
    { id: "date", type: "date", label: "Date", required: true, options: [] },
  ],
  isActive: true,
});
await ok("/api/student/competitions/" + form.id + "/submit", c.studentToken, {
  type: "individual",
  data: { date: today },
  reportDate: today,
});
const formData = await ok(
  "/api/student/competitions/" + form.id,
  c.studentToken,
);
assert.equal(formData.submissions.length, 1);
const formReport = await ok(
  "/api/competitions/" + form.id + "/report",
  c.adminToken,
);
assert.equal(formReport.id, form.id);
assert.equal(formReport.submissions.length, 1);
console.log(
  "Member/leader/teacher access, team and program isolation, public read-only projection, typed legacy API guards and original form workflow passed.",
);
