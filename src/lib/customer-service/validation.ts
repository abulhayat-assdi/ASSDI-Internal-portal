import { z } from "zod";
const text = (max = 200) => z.string().trim().max(max);
export const complaintInput = z
  .object({
    callingNumber: text(40).min(3),
    registeredNumber: text(40).default(""),
    identifier: text().default(""),
    callerType: text().min(1),
    channel: text().min(1),
    complaintType: text().min(1),
    issueType: text().min(1),
    primaryTag: text().default(""),
    tags: z.array(text()).max(20).default([]),
    transactionDate: z.string().datetime().nullable().optional(),
    transactionAmount: z
      .string()
      .regex(/^\d{1,16}(\.\d{1,2})?$/)
      .nullable()
      .optional(),
    transactionId: text(100).default(""),
    description: text(10000).min(1),
    customFields: z
      .record(z.string().max(100), z.union([text(4000), z.number().finite()]))
      .default({}),
  })
  .strict();
export const operation = z
  .object({
    workspaceId: z.string().min(1).max(100),
    action: z.string().max(40),
    id: z.string().max(100).optional(),
    requestId: z.string().uuid(),
    version: z.number().int().positive().optional(),
    data: z.unknown().optional(),
    remark: text(10000).default(""),
    teamId: z.string().max(100).optional(),
    userId: z.string().max(100).optional(),
    initialAction: z.enum(["pending", "resolve", "escalate"]).optional(),
    resolutionReason: z.string().max(200).optional(),
  })
  .strict();
export const optionInput = z
  .object({
    kind: z.enum([
      "callerType",
      "channel",
      "complaintType",
      "issueType",
      "tag",
      "resolutionReason",
      "field",
    ]),
    label: text().min(1),
    parentId: z.string().nullable().optional(),
    active: z.boolean().default(true),
    settings: z
      .object({
        type: z
          .enum(["text", "longText", "number", "date", "select"])
          .optional(),
        required: z.boolean().optional(),
        choices: z.array(text()).max(100).optional(),
        transactionRequired: z.boolean().optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export const policyInput = z
  .object({
    complaintType: text().default(""),
    issueType: text().default(""),
    primaryTag: text().default(""),
    overallMinutes: z.number().int().min(1).max(525600),
    l2Minutes: z.number().int().min(1).max(525600).nullable().default(null),
    l3Minutes: z.number().int().min(1).max(525600).nullable().default(null),
    active: z.boolean().default(true),
  })
  .strict();
