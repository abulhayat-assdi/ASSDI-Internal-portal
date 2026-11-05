import { z } from "zod";

export const rubric = [
  { key: "accuracy", label: "Accuracy & resolution", max: 30 },
  {
    key: "communication",
    label: "Language, empathy & professionalism",
    max: 25,
  },
  { key: "procedure", label: "Verification & escalation", max: 20 },
  { key: "response", label: "Response management", max: 15 },
  { key: "documentation", label: "Closing & documentation", max: 10 },
];
export const metricLabels: Record<string, string> = {
  total: "Total chats",
  active: "Active chats",
  queued: "Queued chats",
  answered: "Answered chats",
  resolved: "Resolved chats",
  abandoned: "Abandoned chats",
  dropped: "Dropped chats",
  frt: "First response (s)",
  queueWait: "Average queue wait (s)",
  art: "Resolution time (s)",
  serviceLevel: "Service level (%)",
  abandonmentRate: "Abandonment rate (%)",
  resolutionRate: "Resolution rate (%)",
  responseTime: "Agent reply time (s)",
  customerResponseTime: "Customer reply time (s)",
  unansweredRate: "Unanswered rate (%)",
  maximumQueueWait: "Maximum queue wait (s)",
  aht: "Handle time (s)",
  customerSatisfaction: "Customer rating (1–5)",
  transferCount: "Accepted transfers",
};
export const settingsSchema = z
  .object({
    capacity: z.number().int().min(1).max(10).default(3),
    acceptSeconds: z.number().int().min(10).max(600).default(30),
    firstReplySeconds: z.number().int().min(15).max(3600).default(60),
    nextReplySeconds: z.number().int().min(15).max(3600).default(60),
    disconnectSeconds: z.number().int().min(30).max(600).default(60),
    warningSeconds: z.number().int().min(60).max(3600).default(300),
    closeSeconds: z.number().int().min(120).max(7200).default(600),
    reopenSeconds: z.number().int().min(0).max(86400).default(3600),
    queueSeconds: z.number().int().min(60).max(7200).default(900),
    passMark: z.number().min(0).max(100).default(70),
    qaRubric: z
      .array(
        z.object({
          key: z
            .string()
            .regex(/^[a-z_]+$/)
            .max(40),
          label: z.string().trim().min(1).max(120),
          max: z.number().int().min(1).max(100),
        }),
      )
      .min(1)
      .max(20)
      .refine(
        (v) =>
          new Set(v.map((r) => r.key)).size === v.length &&
          v.reduce((n, r) => n + r.max, 0) === 100,
        "Rubric keys must be unique and weights must total 100",
      )
      .default(rubric),
    serviceTarget: z.number().min(1).max(100).default(80),
    allowTransfer: z.boolean().default(true),
    feedback: z.boolean().default(true),
    timezone: z
      .string()
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Invalid timezone")
      .default("Asia/Dhaka"),
    businessHours: z
      .object({
        enabled: z.boolean(),
        start: z.number().int().min(0).max(23),
        end: z.number().int().min(1).max(24),
        days: z.array(z.number().int().min(0).max(6)),
      })
      .default({
        enabled: false,
        start: 9,
        end: 18,
        days: [0, 1, 2, 3, 4, 5, 6],
      }),
  })
  .refine(
    (v) => v.closeSeconds > v.warningSeconds,
    "Closure must follow the inactivity warning",
  )
  .refine(
    (v) => v.businessHours.end > v.businessHours.start,
    "Closing hour must follow opening hour",
  );
export const defaults = settingsSchema.parse({});
export const messageInput = z.object({
  requestId: z.string().uuid(),
  text: z.string().trim().min(1).max(8000),
  kind: z.enum(["MESSAGE", "NOTE", "COACH"]).default("MESSAGE"),
});
export const closed = (status: string) =>
  ["RESOLVED", "CLOSED", "ABANDONED", "DROPPED"].includes(status);
export function scoreEvaluation(
  scores: Record<string, number>,
  criteria = rubric,
) {
  if (Object.keys(scores).some((k) => !criteria.some((c) => c.key === k)))
    throw Error("Unknown scoring criterion");
  return criteria.reduce((sum, item) => {
    const n = scores[item.key];
    if (!Number.isFinite(n) || n < 0 || n > item.max)
      throw Error(`Invalid score: ${item.key}`);
    return sum + n;
  }, 0);
}
export function businessOpen(settings: typeof defaults, now = new Date()) {
  if (!settings.businessHours.enabled) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((p) => p.type === "weekday")?.value || "",
  );
  return (
    settings.businessHours.days.includes(day) &&
    hour >= settings.businessHours.start &&
    hour < settings.businessHours.end
  );
}
type Row = {
  status: string;
  createdAt: Date;
  queueAt: Date;
  acceptedAt: Date | null;
  firstReplyAt: Date | null;
  resolvedAt: Date | null;
  serviceSeconds: number;
};
export function metrics(rows: Row[]) {
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const seconds = (end: Date, start: Date) =>
    Math.max(0, (+end - +start) / 1000);
  return {
    total: rows.length,
    active: rows.filter((r) => ["ASSIGNED", "ACTIVE"].includes(r.status))
      .length,
    queued: rows.filter((r) => r.status === "QUEUED").length,
    answered: rows.filter((r) => r.firstReplyAt).length,
    resolved: rows.filter((r) => r.status === "RESOLVED").length,
    abandoned: rows.filter((r) => r.status === "ABANDONED").length,
    dropped: rows.filter((r) => r.status === "DROPPED").length,
    frt: average(
      rows
        .filter((r) => r.firstReplyAt)
        .map((r) => seconds(r.firstReplyAt!, r.queueAt)),
    ),
    queueWait: average(
      rows
        .filter((r) => r.acceptedAt)
        .map((r) => seconds(r.acceptedAt!, r.queueAt)),
    ),
    art: average(
      rows
        .filter((r) => r.status === "RESOLVED" && r.resolvedAt)
        .map((r) => seconds(r.resolvedAt!, r.queueAt)),
    ),
    serviceLevel: rows.length
      ? (rows.filter(
          (r) =>
            r.firstReplyAt &&
            seconds(r.firstReplyAt, r.queueAt) <= r.serviceSeconds,
        ).length /
          rows.length) *
        100
      : null,
    abandonmentRate: rows.length
      ? (rows.filter((r) => r.status === "ABANDONED").length / rows.length) *
        100
      : null,
    resolutionRate: rows.length
      ? (rows.filter((r) => r.status === "RESOLVED").length / rows.length) * 100
      : null,
  };
}
