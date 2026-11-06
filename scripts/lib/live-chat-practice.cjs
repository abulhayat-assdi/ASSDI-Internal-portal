const { randomBytes } = require("node:crypto");
const scenarios = [
  [
    "Payment / পেমেন্ট",
    "Duplicate payment",
    "My payment was deducted twice. Can you help me check it?",
    "Check both transaction references; log a payment case and explain the approved next step.",
  ],
  [
    "Delivery / ডেলিভারি",
    "Late delivery",
    "My order has not arrived within the promised delivery window.",
    "Check the fictional order and delivery window; explain the escalation and follow-up.",
  ],
  [
    "Refund / রিফান্ড",
    "Refund pending",
    "My approved refund has not arrived yet. What should I do?",
    "Verify the training refund reference and approved processing period.",
  ],
  [
    "Account / অ্যাকাউন্ট",
    "Sign-in problem",
    "I cannot sign in to my account. Can you help?",
    "Use permitted verification only. Never ask for passwords, PINs or OTPs.",
  ],
  [
    "Product / পণ্য",
    "Wrong item",
    "I received the wrong item. How can I get the correct one?",
    "Verify the order; explain the approved replacement procedure.",
  ],
  [
    "Service / সেবা",
    "Service interruption",
    "My service has stopped working and I need help urgently.",
    "Acknowledge the impact; check the reference and explain troubleshooting or escalation.",
  ],
  [
    "Sales / সেলস",
    "Product enquiry",
    "I want to know if your service fits my needs before I buy.",
    "Ask about the need; use approved product information and agree a next step.",
  ],
  [
    "Order / অর্ডার",
    "Cancellation request",
    "I want to cancel my order. Is that still possible?",
    "Verify status and cancellation policy before promising cancellation.",
  ],
  [
    "Appointment / অ্যাপয়েন্টমেন্ট",
    "Reschedule request",
    "Can I change my scheduled appointment?",
    "Verify the fictional booking and offer an approved available option.",
  ],
  [
    "Complaint / অভিযোগ",
    "Previous complaint",
    "I reported an issue earlier but have not received an update.",
    "Find the case reference, explain status and document the next follow-up.",
  ],
];
const defaultReferences = [
  [
    "REPLY",
    "Greeting",
    "Hello! Thank you for contacting us. How may I help you today?",
  ],
  ["REPLY", "স্বাগত", "স্বাগতম! আজ আপনাকে কীভাবে সাহায্য করতে পারি?"],
  [
    "KNOWLEDGE",
    "Training verification",
    "Verify the fictional reference before linking a profile. Never request passwords, PINs or OTPs. Use the approved scenario policy.",
  ],
];
async function ensureDefaults(tx, s, settings) {
  await tx.chatSettings.upsert({
    where: { workspaceId: s.workspaceId },
    create: { ...s, value: settings || {} },
    update: {},
  });
  for (const [name] of scenarios)
    await tx.chatCategory.upsert({
      where: { workspaceId_name: { workspaceId: s.workspaceId, name } },
      create: { ...s, name },
      update: {},
    });
  for (const [kind, title, text] of defaultReferences)
    if (
      !(await tx.chatReference.findFirst({
        where: { workspaceId: s.workspaceId, kind, title },
      }))
    )
      await tx.chatReference.create({ data: { ...s, kind, title, text } });
}
async function seedPractice(tx, s, settings, actorId = "system") {
  await ensureDefaults(tx, s, settings);
  const existing = await tx.chatConversation.findMany({
      where: { workspaceId: s.workspaceId, practiceKey: { not: null } },
      select: { practiceKey: true },
    }),
    keys = new Set(existing.map((c) => c.practiceKey));
  const categories = await tx.chatCategory.findMany({
    where: { workspaceId: s.workspaceId },
  });
  let added = 0;
  for (let i = 0; i < 60; i++) {
    const key = "practice-v1-" + String(i + 1).padStart(3, "0");
    if (keys.has(key)) continue;
    const [categoryName, title, opening, guide] =
      scenarios[i % scenarios.length];
    const category = categories.find((c) => c.name === categoryName);
    if (!category) throw Error("Missing practice category");
    const reference = "CHAT-" + String(i + 1).padStart(3, "0"),
      name = "Practice Customer " + String(i + 1).padStart(3, "0");
    const customer = await tx.chatCustomerSession.create({
      data: {
        ...s,
        name,
        tokenHash: randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 3650 * 86400000),
      },
    });
    const bangla = i % 2 === 1;
    const banglaOpening = [
      "আমার পেমেন্ট দুইবার কেটে গেছে। বিষয়টি দেখে সাহায্য করবেন?",
      "নির্ধারিত সময়েও অর্ডারটি পাইনি। কী করতে পারি?",
      "অনুমোদিত রিফান্ড এখনও পাইনি। আপডেট জানাবেন?",
      "অ্যাকাউন্টে প্রবেশ করতে পারছি না। সাহায্য করবেন?",
      "অর্ডারের বদলে অন্য পণ্য পেয়েছি। সঠিক পণ্য কীভাবে পাব?",
      "আমার সেবাটি কাজ করছে না। জরুরি সাহায্য প্রয়োজন।",
      "আপনাদের সেবাটি আমার জন্য উপযোগী হবে কি না জানতে চাই।",
      "আমার অর্ডারটি বাতিল করা যাবে কি?",
      "আমার অ্যাপয়েন্টমেন্টের সময় পরিবর্তন করতে চাই।",
      "আগের অভিযোগের কোনো আপডেট পাইনি। কী অবস্থা জানাবেন?",
    ][i % 10];
    const script = {
      version: 1,
      title,
      guide,
      reference,
      language: bangla ? "bn" : "en",
      replies: bangla
        ? [
            "আমার অনুশীলনের রেফারেন্স " +
              reference +
              "। যাচাই করতে কী তথ্য প্রয়োজন জানাবেন?",
            "ধন্যবাদ। এরপর কী করা হবে? অন্য টিমের সাহায্য প্রয়োজন কি? প্রক্রিয়াটি বুঝিয়ে বলুন।",
            "কত সময়ের মধ্যে আপডেট পাব? অনুমোদিত সময়সীমা অনুযায়ী জানাবেন।",
            "ধন্যবাদ। কথোপকথন শেষ করার আগে পরবর্তী পদক্ষেপ সংক্ষেপে জানিয়ে রাখুন।",
          ]
        : [
            "My training reference is " +
              reference +
              ". Please check what information you need to verify my request.",
            "Thank you. What can you do next, and does this need another team? Please explain the process.",
            "When should I expect an update? Please explain the approved timeline without making an unsupported promise.",
            "Thank you. Please summarize the next step and record the outcome before we finish.",
          ],
    };
    const c = await tx.chatConversation.create({
      data: {
        ...s,
        customerSessionId: customer.id,
        customerName: name,
        categoryId: category.id,
        status: "QUEUED",
        practiceKey: key,
        practiceScript: script,
        policySnapshot: settings || {},
        serviceSeconds: settings?.firstReplySeconds || 60,
      },
    });
    await tx.chatMessage.create({
      data: {
        ...s,
        conversationId: c.id,
        senderId: customer.id,
        senderName: name,
        sender: "CUSTOMER",
        text:
          (bangla ? banglaOpening : opening) +
          " [Fictional training case: " +
          reference +
          "]",
        requestId: key + ":opening",
      },
    });
    added++;
  }
  if (added)
    await tx.chatEvent.create({
      data: {
        ...s,
        actorId,
        type: "practice_loaded",
        data: { added, total: 60, version: 1 },
      },
    });
  return { added, total: 60 };
}
async function advancePractice(tx, s, c) {
  const script = c.practiceScript;
  if (!c.practiceKey || !script || !Array.isArray(script.replies)) return;
  const index = c.practiceStep;
  if (index >= script.replies.length) return;
  const now = new Date();
  const message = await tx.chatMessage.create({
    data: {
      ...s,
      conversationId: c.id,
      senderId: c.customerSessionId,
      senderName: c.customerName,
      sender: "CUSTOMER",
      text: script.replies[index],
      requestId: c.practiceKey + ":reply:" + index,
      createdAt: now,
    },
  });
  await tx.chatConversation.update({
    where: { workspaceId_id: { workspaceId: s.workspaceId, id: c.id } },
    data: {
      practiceStep: { increment: 1 },
      lastCustomerAt: now,
      lastActivityAt: now,
      unansweredAt: now,
      warned: false,
    },
  });
  await tx.chatEvent.create({
    data: {
      ...s,
      actorId: c.customerSessionId,
      type: "message",
      conversationId: c.id,
      data: { messageId: message.id, scripted: true },
    },
  });
}
module.exports = { ensureDefaults, seedPractice, advancePractice, scenarios };
