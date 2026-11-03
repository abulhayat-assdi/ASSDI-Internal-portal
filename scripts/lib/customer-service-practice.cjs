const { createHash, randomBytes, randomUUID } = require("node:crypto");
const {
  loadTrainingCustomers,
  trainingCustomers,
} = require("./customer-service-training.cjs");
function starterRequestIds(scope) {
  return trainingCustomers(250).map((c) => {
    const hex = createHash("sha256")
      .update(
        `starter-v1:${scope.courseId}:${scope.workspaceId}:${c.trainingKey}`,
      )
      .digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  });
}
/** @param {import('../../generated/customer-service').Prisma.TransactionClient} tx
 * @param {{courseId:string,workspaceId:string}} scope
 * @param {{id:string,name:string}} actor
 */
async function loadPracticeDataset(tx, scope, actor) {
  if (!actor?.id || !actor?.name)
    throw Error("An administrator identity is required");
  const training = await loadTrainingCustomers(tx, scope, 500);
  const requestIds = starterRequestIds(scope);
  const existing = await tx.complaint.findMany({
    where: { ...scope, requestId: { in: requestIds } },
    select: { requestId: true },
  });
  const done = new Set(existing.map((c) => c.requestId));
  if (done.size === 250)
    return {
      ...training,
      complaintsAdded: 0,
      starterComplaints: 250,
      referenceCustomers: 250,
    };
  const customers = await tx.customer.findMany({
    where: {
      ...scope,
      trainingKey: { in: trainingCustomers(250).map((c) => c.trainingKey) },
    },
  });
  const options = await tx.option.findMany({
    where: { workspaceId: scope.workspaceId, active: true },
  });
  const fields = options.filter((o) => o.kind === "field");
  const policies = await tx.policy.findMany({
    where: { workspaceId: scope.workspaceId, active: true },
  });
  const complaints = [],
    histories = [],
    interactions = [];
  const now = new Date();
  for (let i = 0; i < 250; i++) {
    if (done.has(requestIds[i])) continue;
    const key = `training-v1-${String(i + 1).padStart(3, "0")}`;
    const customer = customers.find((c) => c.trainingKey === key);
    if (!customer) throw Error("Missing practice customer");
    const profile = customer.trainingProfile;
    const option = (kind, label) => {
      const found = options.find((o) => o.kind === kind && o.label === label);
      if (!found) throw Error("Missing active training option: " + kind);
      return found.id;
    };
    const callerType = option("callerType", profile.callerType),
      channel = option("channel", profile.channel),
      complaintType = option("complaintType", profile.complaintType),
      issueType = option("issueType", profile.issueType);
    const primaryTag =
      options.find(
        (o) => o.kind === "tag" && o.label === "Training" && !o.parentId,
      )?.id || "";
    const candidates = policies.filter(
      (p) =>
        (p.complaintType === complaintType &&
          p.issueType === issueType &&
          (!p.primaryTag || p.primaryTag === primaryTag)) ||
        (!p.complaintType && !p.issueType && !p.primaryTag),
    );
    const rank = (p) => (p.primaryTag ? 3 : p.issueType ? 2 : 1);
    candidates.sort((a, b) => rank(b) - rank(a));
    if (
      !candidates.length ||
      (candidates[1] && rank(candidates[0]) === rank(candidates[1]))
    )
      throw Error("A unique active SLA policy is required");
    const policy = candidates[0];
    const customFields = {};
    for (const field of fields) {
      const settings = field.settings;
      if (!settings.required) continue;
      const value =
        settings.type === "number"
          ? i + 1
          : settings.type === "date"
            ? now.toISOString().slice(0, 10)
            : settings.type === "select"
              ? settings.choices?.[0]
              : `Practice ${profile.reference}`;
      if (value === undefined)
        throw Error("Required training field has no choices");
      customFields[field.id] = value;
    }
    const id = randomUUID(),
      requestId = requestIds[i];
    const complaint = {
      ...scope,
      id,
      code: Array.from(
        randomBytes(10),
        (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 36],
      ).join(""),
      requestId,
      customerId: customer.id,
      creatorId: actor.id,
      ownerId: actor.id,
      callingNumber: customer.number,
      callingNormalized: customer.number,
      registeredNumber: customer.registeredNumber,
      registeredNormalized: customer.registeredNormalized,
      identifier: profile.email,
      callerType,
      channel,
      complaintType,
      issueType,
      primaryTag,
      tags: [],
      transactionDate: now,
      transactionAmount: profile.transactionAmount,
      transactionId: profile.transactionReference,
      description: `[Practice ${profile.reference}] ${customer.name}. ${profile.scenario}`,
      customFields,
      fieldSnapshot: JSON.parse(JSON.stringify(fields)),
      policySnapshot: JSON.parse(JSON.stringify(policy)),
      status: "PENDING",
      queue: "AGENT",
      createdAt: now,
      dueAt: new Date(+now + policy.overallMinutes * 60000),
    };
    complaints.push(complaint);
    histories.push({
      ...scope,
      complaintId: id,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: "ADMIN",
      action: "create",
      before: {},
      after: JSON.parse(JSON.stringify(complaint)),
      remark: "Preloaded practice complaint",
      requestId,
    });
    interactions.push({
      ...scope,
      complaintId: id,
      actorId: actor.id,
      channel,
      note: "Preloaded practice customer contact",
    });
  }
  await tx.complaint.createMany({ data: complaints });
  await tx.history.createMany({ data: histories });
  await tx.interaction.createMany({ data: interactions });
  return {
    ...training,
    complaintsAdded: complaints.length,
    starterComplaints: 250,
    referenceCustomers: 250,
  };
}
module.exports = { loadPracticeDataset, starterRequestIds };
