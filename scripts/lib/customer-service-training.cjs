// Shared by the protected application loader and the one-shot release script.
// Fictional reference profiles; starter pending complaints are loaded separately.
const { createHash } = require("node:crypto");
const VERSION = "training-v1";
const scenarios = [
  [
    "Delivery delay",
    "Service complaint",
    "The parcel is three days late. Verify the delivery estimate, explain the next step and arrange a follow-up.",
  ],
  [
    "Duplicate payment",
    "Billing complaint",
    "The customer sees two charges for one order. Check the transaction references and escalate if the duplicate charge is confirmed.",
  ],
  [
    "Refund pending",
    "Billing complaint",
    "A refund was approved but is not visible yet. Explain the processing window and schedule a callback.",
  ],
  [
    "Wrong item",
    "Product complaint",
    "The delivered colour differs from the order. Confirm the item and explain the replacement process.",
  ],
  [
    "Damaged item",
    "Product complaint",
    "An item arrived damaged. Record the evidence needed and arrange the next action without promising an unapproved refund.",
  ],
  [
    "Account access",
    "Service request",
    "The customer cannot sign in after changing their number. Verify ownership and guide them through account recovery.",
  ],
  [
    "Subscription cancellation",
    "Service request",
    "The customer wants to stop the next renewal. Confirm the subscription and explain the effective cancellation date.",
  ],
  [
    "Warranty enquiry",
    "Information request",
    "The customer needs the warranty process for an item bought last month. Explain the documents and support channel.",
  ],
  [
    "Address correction",
    "Service request",
    "An order contains an old delivery address. Check whether dispatch has started before requesting an address update.",
  ],
  [
    "Payment not reflected",
    "Billing complaint",
    "Payment is marked successful but the order remains unpaid. Record the reference, amount and date, then investigate or escalate.",
  ],
];
const given = [
  "Amina",
  "Farhan",
  "Nadia",
  "Hasan",
  "Samira",
  "Imran",
  "Raisa",
  "Tanvir",
  "Maliha",
  "Arif",
];
const family = [
  "Rahman",
  "Ahmed",
  "Islam",
  "Khan",
  "Hossain",
  "Akter",
  "Chowdhury",
  "Karim",
  "Siddique",
  "Mahmud",
];
const channels = ["Phone", "Email", "Facebook", "Web form"];
const callers = ["Existing customer", "New customer"];
function trainingCustomers(count = 100) {
  return Array.from({ length: count }, (_, index) => {
    const serial = String(index + 1).padStart(3, "0");
    const variation =
      index < 100
        ? index
        : createHash("sha256")
            .update(`training-profile-${serial}`)
            .digest()
            .readUInt32LE(0);
    const [issueType, complaintType, scenario] =
      scenarios[variation % scenarios.length];
    return {
      trainingKey: `${VERSION}-${serial}`,
      name: `${given[variation % 10]} ${family[Math.floor(variation / 10) % 10]} (Training ${serial})`,
      number: `00010000${serial}`,
      registeredNumber: `00020000${serial}`,
      registeredNormalized: `00020000${serial}`,
      dummy: true,
      trainingProfile: {
        reference: `TRAIN-${serial}`,
        email: `customer${serial}@example.test`,
        callerType: callers[variation % callers.length],
        channel:
          channels[
            Math.floor(variation / (index < 100 ? 1 : 11)) % channels.length
          ],
        complaintType,
        issueType,
        scenario,
        transactionReference: `TRAIN-TXN-${serial}`,
        transactionAmount: String(500 + index * 25),
      },
    };
  });
}

/** @param {import('../../generated/customer-service').Prisma.TransactionClient} tx
 * @param {{courseId:string,workspaceId:string}} scope
 */
async function loadTrainingCustomers(tx, scope, count = 100) {
  // Serialize repeated provisioning/loading within one workspace.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope.workspaceId}), 100)`;
  const workspace = await tx.workspace.findFirst({
    where: { id: scope.workspaceId, courseId: scope.courseId },
  });
  if (!workspace || workspace.state !== "ACTIVE")
    throw Error("An active workspace is required to load training customers");
  const definitions = {
    callerType: callers,
    channel: channels,
    complaintType: [...new Set(scenarios.map((s) => s[1]))],
    issueType: scenarios.map((s) => s[0]),
    tag: ["Training", "Delivery", "Payment", "Account", "Product"],
    resolutionReason: [
      "Information provided",
      "Issue corrected",
      "Refund arranged",
      "Replacement arranged",
      "Request completed",
    ],
  };
  for (const [kind, labels] of Object.entries(definitions)) {
    await tx.option.createMany({
      data: labels.map((label) => ({ ...scope, kind, label })),
      skipDuplicates: true,
    });
  }
  // Never overwrite an existing or deliberately archived policy/team.
  await tx.policy.upsert({
    where: {
      workspaceId_key: {
        workspaceId: scope.workspaceId,
        key: JSON.stringify(["", "", ""]),
      },
    },
    create: {
      ...scope,
      key: JSON.stringify(["", "", ""]),
      overallMinutes: 60,
      l2Minutes: 20,
      l3Minutes: 10,
    },
    update: {},
  });
  await tx.team.createMany({
    data: [
      { ...scope, name: "Training L2", tier: "L2" },
      { ...scope, name: "Training L3", tier: "L3" },
    ],
    skipDuplicates: true,
  });
  const result = await tx.customer.createMany({
    data: trainingCustomers(count).map((customer) => ({
      ...scope,
      ...customer,
    })),
    skipDuplicates: true,
  });
  const total = await tx.customer.count({
    where: {
      ...scope,
      trainingKey: { in: trainingCustomers(count).map((c) => c.trainingKey) },
    },
  });
  if (total !== count)
    throw Error(
      "Training number conflict: no existing customer was overwritten. Review the workspace before retrying.",
    );
  return { added: result.count, total, version: VERSION };
}
module.exports = { trainingCustomers, loadTrainingCustomers, VERSION };
