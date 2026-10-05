/**
 * Pure rules for the live (hosted, Kahoot-style) quiz mode — no DB imports so
 * the timing and scoring maths can be unit-tested directly (live.test.ts).
 */

export type LiveStatus = "LOBBY" | "QUESTION" | "REVEAL" | "FINISHED";

/** Grace for network latency between the deadline and a late answer reaching the server. */
export const ANSWER_GRACE_MS = 1500;

export interface LiveClockInput {
    status: LiveStatus;
    questionStartedAt: Date | null;
    limitSeconds: number;
}

/** Remaining time for the open question, in ms (0 once the deadline passed). */
export function remainingMs(input: LiveClockInput, now: number): number {
    if (input.status !== "QUESTION" || !input.questionStartedAt) return 0;
    const deadline = input.questionStartedAt.getTime() + input.limitSeconds * 1000;
    return Math.max(0, deadline - now);
}

/**
 * The status clients should see. A QUESTION whose timer ran out reads as
 * REVEAL without any host action or background job — the stored status only
 * changes when the host moves on.
 */
export function effectiveStatus(input: LiveClockInput, now: number): LiveStatus {
    if (input.status === "QUESTION" && remainingMs(input, now) <= 0) return "REVEAL";
    return input.status;
}

/** Whether an answer arriving at `now` still counts. */
export function canAnswer(input: LiveClockInput, now: number): boolean {
    if (input.status !== "QUESTION" || !input.questionStartedAt) return false;
    const deadline = input.questionStartedAt.getTime() + input.limitSeconds * 1000;
    return now <= deadline + ANSWER_GRACE_MS;
}

/**
 * Points for a correct answer: half the marks for answering at the last
 * moment, full marks for answering instantly. Rounded to one decimal.
 */
export function speedScaledMarks(marks: number, responseMs: number, limitSeconds: number): number {
    const limitMs = Math.max(1, limitSeconds * 1000);
    const used = Math.min(Math.max(responseMs, 0), limitMs);
    const factor = 0.5 + 0.5 * (1 - used / limitMs);
    return Math.round(marks * factor * 10) / 10;
}

/** 6-digit numeric join code, easy to read out in a classroom. */
export function generateJoinCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export interface RankedRow {
    score: number;
    totalResponseMs: number;
}

/** Highest score first; ties go to whoever answered faster overall. */
export function compareRank(a: RankedRow, b: RankedRow): number {
    return b.score - a.score || a.totalResponseMs - b.totalResponseMs;
}
