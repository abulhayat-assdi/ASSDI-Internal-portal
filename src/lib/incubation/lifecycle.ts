import { todayDhaka } from "./domain";

/** Stored program status. "running"/"scheduled"/"ended" are derived from dates, never stored. */
export const PROGRAM_STATUSES = ["draft", "active", "closing", "closed", "archived", "cancelled"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  draft: "খসড়া",
  active: "সক্রিয়",
  scheduled: "আসন্ন",
  running: "চলমান",
  ended: "সময় শেষ",
  closing: "হিসাব মেলানো চলছে",
  closed: "বন্ধ",
  archived: "আর্কাইভ",
  cancelled: "বাতিল",
};

/**
 * Allowed status changes. Moving backwards (reopening) is possible but always
 * needs a written reason, so the audit log says why a finished program changed.
 */
const TRANSITIONS: Record<ProgramStatus, ProgramStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["closing", "closed", "draft", "cancelled"],
  closing: ["active", "closed"],
  closed: ["closing", "archived"],
  archived: ["closed"],
  cancelled: ["draft", "archived"],
};
const NEEDS_REASON = new Set([
  "active>draft",
  "active>cancelled",
  "draft>cancelled",
  "closing>active",
  "closed>closing",
  "archived>closed",
  "cancelled>draft",
]);

/** Statuses in which nothing but a status change is accepted. */
const LOCKED: ReadonlySet<string> = new Set(["closed", "archived", "cancelled"]);
export const isProgramLocked = (status: string) => LOCKED.has(status);

export function allowedTransitions(from: string): ProgramStatus[] {
  return TRANSITIONS[from as ProgramStatus] ?? [];
}

export function transitionNeedsReason(from: string, to: string) {
  return NEEDS_REASON.has(`${from}>${to}`);
}

/** Returns a Bangla error message, or null when the change is allowed. */
export function checkTransition(from: string, to: string, reason = ""): string | null {
  if (from === to) return null;
  if (!allowedTransitions(from).includes(to as ProgramStatus)) {
    return `"${STATUS_LABELS[from] ?? from}" থেকে সরাসরি "${STATUS_LABELS[to] ?? to}" করা যায় না।`;
  }
  if (transitionNeedsReason(from, to) && reason.trim().length < 3) {
    return `"${STATUS_LABELS[from] ?? from}" থেকে "${STATUS_LABELS[to] ?? to}" করতে কারণ লিখুন।`;
  }
  return null;
}

/** Error shown when anything is written to a closed/archived/cancelled program. */
export function lockedMessage(status: string) {
  return `এই প্রোগ্রাম "${STATUS_LABELS[status] ?? status}" অবস্থায় আছে, তাই কোনো পরিবর্তন করা যাবে না। প্রয়োজনে প্রশাসক কারণসহ প্রোগ্রাম আবার চালু করবেন।`;
}

export function incubationState(
  p: { status: string; startDate: string; endDate?: string | null },
  today = todayDhaka(),
) {
  if (p.status === "draft") return "draft";
  if (["archived", "cancelled", "closed", "closing"].includes(p.status)) return p.status;
  if (p.startDate > today) return "scheduled";
  if (p.endDate && p.endDate < today) return "ended";
  return "running";
}
export function isIncubationRunning(p: Parameters<typeof incubationState>[0]) {
  return incubationState(p) === "running";
}
